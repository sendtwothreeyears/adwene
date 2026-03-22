import { useState, useEffect, useRef, useCallback } from "react";
import { useAppStore } from "../../stores/appStore";
import * as db from "../../lib/db";
import type { Patient, Template, SessionNoteTab } from "../../types";
import type { SerializedEditorState } from "lexical";
import SessionTopBar from "./SessionTopBar";
import SessionTabBar, { type SessionTab, getNoteId } from "./SessionTabBar";
import SessionEditor from "./SessionEditor";
import NoteToolbar from "./NoteToolbar";
import { useAudioCapture } from "../../hooks/useAudioCapture";
import { useAudioDevices } from "../../hooks/useAudioDevices";
import { useAudioPreview } from "../../hooks/useAudioPreview";
import { useRecordingTimer } from "../../hooks/useRecordingTimer";
import { useTranscription } from "../../hooks/useTranscription";
import { useNoteGeneration } from "../../hooks/useNoteGeneration";
import { useSidecar } from "../../contexts/SidecarContext";
import { useTextExtraction } from "../../hooks/useTextExtraction";
import { usePdfExport } from "../../hooks/usePdfExport";
import { useSmoothStream } from "../../hooks/useSmoothStream";
import { getLiveTranscriptionEnabled } from "../settings/TranscriptionSettingsPane";
import { markdownToLexical } from "../../lib/markdown-to-lexical";
import { lexicalToHtml } from "../../lib/lexical-to-html";
import ContextAttachments, { type AttachmentWithStatus } from "./ContextAttachments";
import QuickPatientModal from "../patients/QuickPatientModal";
import TemplateSelectorModal from "../templates/TemplateSelectorModal";
import ConfirmModal from "../ui/ConfirmModal";
import Toast from "../ui/Toast";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { copyFile, mkdir, remove, stat, writeFile } from "@tauri-apps/plugin-fs";
import { openPath } from "@tauri-apps/plugin-opener";
import { appDataDir } from "@tauri-apps/api/path";

/** Extract plain text from a serialized Lexical editor state.
 *  When opts.markdown is true, heading nodes emit markdown `#`/`##`/`###`
 *  prefixes and bold-only short paragraphs emit `## ` (custom template fallback). */
function extractTextFromLexical(
  state: SerializedEditorState,
  opts?: { markdown?: boolean },
): string {
  const md = opts?.markdown === true;
  const lines: string[] = [];
  function walk(node: Record<string, unknown>) {
    if (node.type === "text" && typeof node.text === "string") {
      lines.push(node.text);
    }
    if (node.type === "linebreak") {
      lines.push("\n");
    }
    if (node.type === "paragraph" || node.type === "heading") {
      if (lines.length > 0 && lines[lines.length - 1] !== "\n") lines.push("\n");
    }
    if (Array.isArray(node.children)) {
      // Markdown heading prefix for heading nodes
      if (md && node.type === "heading" && typeof node.tag === "string") {
        const level = parseInt(node.tag.replace("h", ""), 10);
        if (level >= 1 && level <= 6) {
          lines.push("#".repeat(level) + " ");
        }
      }
      // Markdown heading fallback: bold-only short paragraph → ## prefix
      if (
        md &&
        node.type === "paragraph" &&
        node.children.length === 1
      ) {
        const child = node.children[0] as Record<string, unknown>;
        if (
          child.type === "text" &&
          typeof child.text === "string" &&
          typeof child.format === "number" &&
          (child.format & 1) !== 0 &&
          child.text.length <= 60
        ) {
          lines.push("## ");
        }
      }
      for (const child of node.children) walk(child as Record<string, unknown>);
      if (node.type === "paragraph" || node.type === "heading") lines.push("\n");
    }
  }
  walk(state.root as unknown as Record<string, unknown>);
  return lines.join("").trim();
}

/** Maps a tab to the Session field it reads/writes. Note tabs map to "notes" (legacy single-note). */
function getTabField(tab: SessionTab): "context" | "transcript" | "notes" {
  if (tab === "context") return "context";
  if (tab === "transcription") return "transcript";
  return "notes"; // note:* tabs
}

function getTabPlaceholder(tab: SessionTab): string {
  if (tab === "context") return "Add any additional context about the patient...";
  if (tab === "transcription") return "Transcription will appear here during recording...";
  return "Generated note will appear here...";
}

const SAVE_DEBOUNCE_MS = 800;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const WARN_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const STREAM_DEBOUNCE_MS = 200;

export default function SessionView() {
  const activeSession = useAppStore((s) => s.activeSession);
  const setActiveSession = useAppStore((s) => s.setActiveSession);
  const mergeActiveSession = useAppStore((s) => s.mergeActiveSession);
  const providerId = useAppStore((s) => s.providerId);
  const showEntityHighlights = useAppStore((s) => s.showEntityHighlights);
  const toggleEntityHighlights = useAppStore((s) => s.toggleEntityHighlights);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [activeTab, setActiveTab] = useState<SessionTab>("context");
  const [error, setError] = useState<string | null>(null);
  const [streamPreview, setStreamPreview] = useState<SerializedEditorState | null>(null);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<AttachmentWithStatus[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [showQuickPatient, setShowQuickPatient] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant: "success" | "error"; visible: boolean }>({ message: "", variant: "success", visible: false });
  const [noteTabs, setNoteTabs] = useState<SessionNoteTab[]>([]);
  /** Lexical JSON for the currently active note tab (loaded from session_notes). */
  const [activeNoteContent, setActiveNoteContent] = useState<SerializedEditorState | null>(null);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [noteLoading, setNoteLoading] = useState(false);
  const [confirmDeleteNote, setConfirmDeleteNote] = useState<string | null>(null);

  const {
    devices,
    selectedDeviceId,
    permissionState,
    selectDevice,
    requestPermission,
  } = useAudioDevices();

  const audioPreviewStream = useAudioPreview(
    permissionState === "granted" ? selectedDeviceId : null
  );

  const {
    isTranscribing,
    refinedTranscript,
    error: transcriptionError,
    startTranscription,
    stopTranscription,
    sendAudioChunk,
    reset: resetTranscription,
  } = useTranscription();

  const {
    state: captureState,
    start,
    stop,
    switchDevice,
    error: captureError,
  } = useAudioCapture({ onChunk: sendAudioChunk, deviceId: selectedDeviceId });

  const {
    formattedTime: recordingTime,
    start: startTimer,
    stop: stopTimer,
  } = useRecordingTimer();

  const {
    isGenerating,
    isStreaming,
    streamingText,
    error: noteError,
    generateNote,
    onNoteGenerated,
    activeNoteId,
  } = useNoteGeneration();

  const { connectionState, send, onMessage } = useSidecar();
  const { extractText } = useTextExtraction();
  const { generatePdf } = usePdfExport();
  const { smoothText, appendChunk, flush: flushSmooth, reset: resetSmooth } = useSmoothStream();
  const sidecarConnected = connectionState === "connected";

  const handleSelectDevice = useCallback(
    (deviceId: string | null) => {
      selectDevice(deviceId);
      if (captureState === "recording") {
        switchDevice(deviceId);
      }
    },
    [selectDevice, switchDevice, captureState]
  );

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<{ sessionId: string; field: string; state: SerializedEditorState } | null>(null);

  // Feed raw streaming text into the smooth buffer
  useEffect(() => {
    if (isStreaming && streamingText) {
      appendChunk(streamingText);
    }
  }, [isStreaming, streamingText, appendChunk]);

  // Reset smooth buffer on stream start, flush on stream end
  const wasStreamingRef = useRef(false);
  useEffect(() => {
    if (isStreaming && !wasStreamingRef.current) {
      resetSmooth();
    } else if (!isStreaming && wasStreamingRef.current) {
      flushSmooth();
    }
    wasStreamingRef.current = isStreaming;
  }, [isStreaming, resetSmooth, flushSmooth]);

  const smoothTextRef = useRef(smoothText);
  smoothTextRef.current = smoothText;

  // Reset tab and local state when switching sessions
  useEffect(() => {
    setActiveTab("context");
    setError(null);
    setStreamPreview(null);
    setConfirmRegenerate(false);
    setConfirmDelete(false);
    setActiveNoteContent(null);
    resetTranscription();
  }, [activeSession?.id, resetTranscription]);

  // Load or create default note tab when session changes
  useEffect(() => {
    if (!activeSession?.id) {
      setNoteTabs([]);
      return;
    }
    const sessionId = activeSession.id;
    (async () => {
      try {
        let tabs = await db.getSessionNoteTabs(sessionId);
        if (tabs.length === 0) {
          // Create a default note tab using provider's default template
          const provider = await db.getProvider();
          let templateId = provider?.defaultTemplateId ?? null;
          let templateName = "SOAP Note";
          if (templateId) {
            const tmpl = await db.getTemplate(templateId);
            if (tmpl) {
              templateName = tmpl.name;
            } else {
              templateId = null; // template was deleted
            }
          }
          if (!templateId) {
            // Fall back to first system template named "SOAP Note", or first template
            const allTemplates = await db.listTemplates(provider?.id ?? "");
            const soap = allTemplates.find((t) => t.name === "SOAP Note" && t.isSystem);
            const fallback = soap ?? allTemplates[0];
            if (fallback) {
              templateId = fallback.id;
              templateName = fallback.name;
            }
          }
          if (templateId) {
            const note = await db.createSessionNote({
              sessionId,
              templateId,
              templateName,
            });
            tabs = [{ id: note.id, templateId, templateName: note.templateName }];
          }
        }
        setNoteTabs(tabs);
      } catch (err) {
        console.error("Failed to load/create note tabs:", err);
        setNoteTabs([]);
      }
    })();
  }, [activeSession?.id]);

  // Flush pending save and load note content when switching to a note tab
  useEffect(() => {
    // Flush any pending save from the previous tab
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const pending = pendingSaveRef.current;
    if (pending) {
      if (pending.field.startsWith("note:")) {
        const nid = pending.field.slice(5);
        db.updateSessionNote(nid, JSON.stringify(pending.state)).catch((err) =>
          console.error("Failed to flush note save on tab switch:", err),
        );
      } else {
        db.updateSession(pending.sessionId, { [pending.field]: pending.state }).catch((err) =>
          console.error("Failed to flush save on tab switch:", err),
        );
      }
      pendingSaveRef.current = null;
    }

    const nid = getNoteId(activeTab);
    if (!nid) {
      setActiveNoteContent(null);
      setNoteLoading(false);
      return;
    }
    // Clear immediately to prevent stale content from the previous tab being displayed
    // while the async DB load is in progress.
    setActiveNoteContent(null);
    setNoteLoading(true);
    (async () => {
      try {
        const note = await db.getSessionNote(nid);
        if (note?.content) {
          setActiveNoteContent(typeof note.content === "string" ? JSON.parse(note.content) : note.content);
        } else {
          setActiveNoteContent(null);
        }
      } catch {
        setActiveNoteContent(null);
      } finally {
        setNoteLoading(false);
      }
    })();
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync the template dropdown to match the active note tab's template.
  // Separate from the content-loading effect to avoid re-fetching content when noteTabs changes.
  useEffect(() => {
    const nid = getNoteId(activeTab);
    if (!nid) return;
    const tab = noteTabs.find((t) => t.id === nid);
    if (tab?.templateId) {
      setSelectedTemplateId(tab.templateId);
    } else {
      setSelectedTemplateId(null);
    }
  }, [activeTab, noteTabs]);

  useEffect(() => {
    if (!activeSession?.patientId) {
      setPatient(null);
      return;
    }
    db.getPatient(activeSession.patientId).then(setPatient).catch(() => setPatient(null));
  }, [activeSession?.patientId]);

  // Load patients list for the picker
  useEffect(() => {
    if (!providerId) return;
    db.listPatients(providerId).then(setPatients).catch(() => setPatients([]));
  }, [providerId]);

  const handlePatientChange = useCallback(async (selectedPatient: Patient) => {
    if (!activeSession) return;
    try {
      await db.updateSession(activeSession.id, { patientId: selectedPatient.id });
      mergeActiveSession(activeSession.id, { patientId: selectedPatient.id });
      setToast({ message: `Session linked to ${selectedPatient.firstName} ${selectedPatient.lastName}`, variant: "success", visible: true });
    } catch {
      setToast({ message: "Failed to link patient", variant: "error", visible: true });
    }
  }, [activeSession, mergeActiveSession]);

  const handlePatientCreated = useCallback((newPatient: Patient) => {
    setPatients((prev) => [...prev, newPatient].sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)));
    handlePatientChange(newPatient);
  }, [handlePatientChange]);

  const getSelectedTemplateText = useCallback(() => {
    if (!selectedTemplateId) return "";
    const tmpl = templates.find((t) => t.id === selectedTemplateId);
    if (!tmpl?.content) return "";
    try {
      return extractTextFromLexical(tmpl.content as SerializedEditorState, { markdown: true });
    } catch {
      return "";
    }
  }, [selectedTemplateId, templates]);

  /** Get template text for a specific note tab (by noteId), avoiding stale global state. */
  const getTemplateTextForNote = useCallback((noteId: string) => {
    const noteTab = noteTabs.find((t) => t.id === noteId);
    if (!noteTab) return getSelectedTemplateText();
    const tmpl = templates.find((t) => t.id === noteTab.templateId);
    if (!tmpl?.content) return "";
    try {
      return extractTextFromLexical(tmpl.content as SerializedEditorState, { markdown: true });
    } catch {
      return "";
    }
  }, [noteTabs, templates, getSelectedTemplateText]);

  /** Gather all context sources into a single string for note generation. */
  const getContextText = useCallback(() => {
    const parts: string[] = [];

    // Patient context (from patient record)
    if (patient?.context) {
      parts.push(`Patient context:\n${patient.context}`);
    }

    // Session typed context (from Lexical editor)
    if (activeSession?.context) {
      try {
        const text = extractTextFromLexical(activeSession.context as SerializedEditorState);
        if (text.trim()) {
          parts.push(`Session notes:\n${text}`);
        }
      } catch { /* ignore parse errors */ }
    }

    // Attachment extracted texts
    for (const att of attachments) {
      if (att.extractedText?.trim()) {
        parts.push(`Attached file (${att.fileName}):\n${att.extractedText}`);
      }
    }

    const combined = parts.join("\n\n");
    // Truncate to ~4000 chars to stay within token budget
    return combined.length > 4000 ? combined.slice(0, 4000) + "\n[context truncated]" : combined;
  }, [patient, activeSession, attachments]);

  // Load templates for note generation selector, respecting provider's default
  useEffect(() => {
    if (!providerId) return;
    Promise.all([db.listTemplates(providerId), db.getProvider()]).then(([list, provider]) => {
      setTemplates(list);
      // Use provider's default template if set, otherwise fall back to first
      if (!selectedTemplateId && list.length > 0) {
        const defaultId = provider?.defaultTemplateId;
        const hasDefault = defaultId && list.some((t) => t.id === defaultId);
        setSelectedTemplateId(hasDefault ? defaultId : list[0].id);
      }
    }).catch(() => setTemplates([]));
  }, [providerId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load attachments when session changes
  useEffect(() => {
    if (!activeSession?.id) {
      setAttachments([]);
      return;
    }
    db.listAttachments(activeSession.id)
      .then((list) => setAttachments(list))
      .catch(() => setAttachments([]));
  }, [activeSession?.id]);

  const handleAttach = useCallback(async () => {
    if (!activeSession) return;
    if (!sidecarConnected) {
      setError("Sidecar not connected — cannot extract file text. Start the sidecar and try again.");
      return;
    }
    const selected = await openDialog({
      multiple: true,
      filters: [{ name: "Documents", extensions: ["pdf", "txt", "csv", "md"] }],
    });
    if (!selected) return;

    const paths = Array.isArray(selected) ? selected : [selected];
    const dataDir = await appDataDir();
    const attachDir = `${dataDir.endsWith("/") ? dataDir : dataDir + "/"}attachments/${activeSession.id}`;
    await mkdir(attachDir, { recursive: true });

    for (const filePath of paths) {
      const fileName = filePath.split("/").pop() ?? "file";
      const destPath = `${attachDir}/${crypto.randomUUID()}_${fileName}`;

      try {
        await copyFile(filePath, destPath);

        const fileStat = await stat(destPath);
        const fileSize = fileStat.size;
        const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
        const mimeType = ext === "pdf" ? "application/pdf" : "text/plain";

        const att = await db.createAttachment({
          sessionId: activeSession.id,
          fileName,
          fileSize,
          mimeType,
          extractedText: null,
          filePath: destPath,
        });

        // Show as extracting
        setAttachments((prev) => [...prev, { ...att, _extracting: true }]);

        // Extract text via sidecar
        try {
          const text = await extractText(destPath);
          await db.updateAttachmentText(att.id, text);
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === att.id ? { ...a, extractedText: text, _extracting: false } : a
            )
          );
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "Extraction failed";
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === att.id ? { ...a, _extracting: false, _error: errMsg } : a
            )
          );
        }
      } catch (err) {
        console.error("Failed to attach file:", err);
      }
    }
  }, [activeSession, extractText, sidecarConnected]);

  const handleRemoveAttachment = useCallback(async (id: string) => {
    const att = attachments.find((a) => a.id === id);
    if (!att) return;
    try {
      await db.deleteAttachment(id);
      try { await remove(att.filePath); } catch { /* file may not exist */ }
      setAttachments((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error("Failed to remove attachment:", err);
    }
  }, [attachments]);

  // Throttled streaming preview: convert smoothed text → Lexical at a fixed
  // interval while streaming. Uses smoothTextRef so the interval reads the
  // latest smoothed output without re-running on every rAF update.
  useEffect(() => {
    if (!isStreaming) {
      setStreamPreview(null);
      return;
    }

    const tick = () => {
      const text = smoothTextRef.current;
      if (text) {
        try {
          setStreamPreview(markdownToLexical(text));
        } catch {
          // Partial markdown may fail to parse — ignore until next tick
        }
      }
    };

    tick();
    const id = setInterval(tick, STREAM_DEBOUNCE_MS);
    return () => clearInterval(id);
  }, [isStreaming]);

  // Clear stale streamPreview when the user switches tabs so the next tab
  // doesn't briefly display content from a different note.
  useEffect(() => {
    setStreamPreview(null);
  }, [activeTab]);

  // Save generated note to session_notes DB and update local state, then regenerate title
  useEffect(() => {
    onNoteGenerated(async (noteId, content) => {
      if (!activeSession) return;
      try {
        const lexicalState =
          typeof content === "string"
            ? markdownToLexical(content)
            : (content as SerializedEditorState);

        // Update display IMMEDIATELY so there's no gap between streaming ending
        // and the final content appearing. The DB write can happen after.
        if (getNoteId(activeTab) === noteId) {
          setActiveNoteContent(lexicalState);
        }
        // Persist to session_notes table
        await db.updateSessionNote(noteId, JSON.stringify(lexicalState));

        // Regenerate session title to reflect the current transcript
        const transcript = activeSession.rawTranscript;
        if (transcript) {
          const sid = activeSession.id;
          send(JSON.stringify({ type: "generate_title", session_id: sid, transcript }));
          const unsub = onMessage((raw: string) => {
            try {
              const data = JSON.parse(raw);
              if (data.type === "title" && data.session_id === sid) {
                unsub();
                const title = data.title as string;
                db.updateSession(sid, { title }).catch((e) => console.error("Failed to save title:", e));
                mergeActiveSession(sid, { title });
              }
            } catch { /* ignore parse errors */ }
          });
        }
      } catch (err) {
        console.error("Failed to save generated note:", err);
      }
    });
  }, [activeSession, activeTab, mergeActiveSession, onNoteGenerated, send, onMessage]);

  // Persist refined transcript to DB so note generation uses the best version
  useEffect(() => {
    if (!refinedTranscript || !activeSession) return;
    try {
      const lexicalState = markdownToLexical(refinedTranscript);
      db.updateSession(activeSession.id, {
        rawTranscript: refinedTranscript,
        transcript: lexicalState,
      });
      mergeActiveSession(activeSession.id, {
        rawTranscript: refinedTranscript,
        transcript: lexicalState,
      });
    } catch (err) {
      console.error("Failed to persist refined transcript:", err);
    }
  }, [refinedTranscript, activeSession, mergeActiveSession]);

  // Flush pending save on unmount
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const pending = pendingSaveRef.current;
      if (pending) {
        if (pending.field.startsWith("note:")) {
          const nid = pending.field.slice(5);
          db.updateSessionNote(nid, JSON.stringify(pending.state)).catch((err) =>
            console.error(`Failed to flush pending note save:`, err),
          );
        } else {
          db.updateSession(pending.sessionId, { [pending.field]: pending.state }).catch((err) =>
            console.error(`Failed to flush pending save:`, err),
          );
        }
        pendingSaveRef.current = null;
      }
    };
  }, []);

  const handleStartRecording = useCallback(async () => {
    if (!activeSession) return;
    setActiveTab("transcription");

    // Clear stale transcript so note generation cannot use the old one
    // while the new recording is in progress.
    await db.updateSession(activeSession.id, { rawTranscript: null, transcript: null });
    mergeActiveSession(activeSession.id, { rawTranscript: null, transcript: null });

    const mode = getLiveTranscriptionEnabled() ? "live" : "batch";
    startTranscription(activeSession.id, mode);
    startTimer();
    await start();
  }, [activeSession, start, startTranscription, startTimer, mergeActiveSession]);

  const handleStopRecording = useCallback(async () => {
    stopTimer();
    const textPromise = stopTranscription(); // must come before stop() to keep isTranscribing=true
    await stop();
    const text = await textPromise;
    if (text && activeSession) {
      try {
        const lexicalState = markdownToLexical(text);
        await db.updateSession(activeSession.id, { rawTranscript: text, transcript: lexicalState });
        mergeActiveSession(activeSession.id, { rawTranscript: text, transcript: lexicalState });

        // Fire-and-forget title generation
        const sid = activeSession.id;
        send(JSON.stringify({ type: "generate_title", session_id: sid, transcript: text }));
        const unsub = onMessage((raw: string) => {
          try {
            const data = JSON.parse(raw);
            if (data.type === "title" && data.session_id === sid) {
              unsub();
              const title = data.title as string;
              db.updateSession(sid, { title }).catch((e) => console.error("Failed to save title:", e));
              mergeActiveSession(sid, { title });
            }
          } catch { /* ignore parse errors */ }
        });

        // Auto-generate note on default note tab using the tab's own template
        if (noteTabs.length > 0) {
          const defaultNoteTab = noteTabs[0];
          setActiveTab(`note:${defaultNoteTab.id}`);
          generateNote(sid, defaultNoteTab.id, text, getTemplateTextForNote(defaultNoteTab.id), getContextText());
        }
      } catch (err) {
        console.error("Failed to save rawTranscript:", err);
      }
    }
  }, [stop, stopTranscription, activeSession, mergeActiveSession, send, onMessage, noteTabs, generateNote, getTemplateTextForNote, getContextText]);

  const handleEditorChange = useCallback(
    (state: SerializedEditorState) => {
      if (!activeSession) return;
      const nid = getNoteId(activeTab);

      if (nid) {
        // Save to session_notes table
        pendingSaveRef.current = { sessionId: activeSession.id, field: `note:${nid}`, state };
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(async () => {
          pendingSaveRef.current = null;
          try {
            await db.updateSessionNote(nid, JSON.stringify(state));
            setActiveNoteContent(state);
          } catch (err) {
            console.error(`Failed to save note ${nid}:`, err);
          }
        }, SAVE_DEBOUNCE_MS);
      } else {
        // Save to session table (context, transcript)
        const field = getTabField(activeTab);
        pendingSaveRef.current = { sessionId: activeSession.id, field, state };
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(async () => {
          pendingSaveRef.current = null;
          try {
            // When transcript is edited, also update rawTranscript so note
            // regeneration picks up the edits.
            if (field === "transcript") {
              const plainText = extractTextFromLexical(state);
              await db.updateSession(activeSession.id, { [field]: state, rawTranscript: plainText });
              mergeActiveSession(activeSession.id, { [field]: state, rawTranscript: plainText });
            } else {
              await db.updateSession(activeSession.id, { [field]: state });
              mergeActiveSession(activeSession.id, { [field]: state });
            }
          } catch (err) {
            console.error(`Failed to save ${field}:`, err);
          }
        }, SAVE_DEBOUNCE_MS);
      }
    },
    [activeSession, activeTab, mergeActiveSession],
  );

  /** Handle '+' button: user selects a template, we create a note and auto-generate. */
  const handleAddNote = useCallback(async (templateId: string | null) => {
    setShowAddNoteModal(false);
    if (!templateId || !activeSession) return;
    const tmpl = templates.find((t) => t.id === templateId);
    if (!tmpl) return;

    try {
      const note = await db.createSessionNote({
        sessionId: activeSession.id,
        templateId: tmpl.id,
        templateName: tmpl.name,
      });
      const newTab: SessionNoteTab = { id: note.id, templateId: tmpl.id, templateName: note.templateName };
      setNoteTabs((prev) => [...prev, newTab]);
      // Clear stale content before tab switch so the first render is clean
      setActiveNoteContent(null);
      setNoteLoading(true);
      setStreamPreview(null);
      setActiveTab(`note:${note.id}`);
      setSelectedTemplateId(tmpl.id);

      // Auto-generate if transcript exists
      const transcript = activeSession.rawTranscript;
      if (transcript) {
        resetSmooth();
        wasStreamingRef.current = false;
        const templateText = extractTextFromLexical(tmpl.content as SerializedEditorState, { markdown: true });
        generateNote(activeSession.id, note.id, transcript, templateText, getContextText());
      }
    } catch (err) {
      console.error("Failed to add note tab:", err);
    }
  }, [activeSession, templates, generateNote, getContextText]);

  /** Delete a note tab and its DB row. */
  const handleDeleteNote = useCallback(async (noteId: string) => {
    setConfirmDeleteNote(null);
    try {
      const isLastNote = noteTabs.length === 1 && noteTabs[0].id === noteId;
      await db.deleteSessionNote(noteId);

      if (isLastNote && activeSession) {
        // Recreate a default note tab so there's always at least one
        const provider = await db.getProvider();
        let templateId = provider?.defaultTemplateId ?? null;
        let templateName = "SOAP Note";
        if (templateId) {
          const tmpl = await db.getTemplate(templateId);
          if (tmpl) {
            templateName = tmpl.name;
          } else {
            templateId = null;
          }
        }
        if (!templateId) {
          const allTemplates = await db.listTemplates(provider?.id ?? "");
          const soap = allTemplates.find((t) => t.name === "SOAP Note" && t.isSystem);
          const fallback = soap ?? allTemplates[0];
          if (fallback) {
            templateId = fallback.id;
            templateName = fallback.name;
          }
        }
        if (templateId) {
          const note = await db.createSessionNote({
            sessionId: activeSession.id,
            templateId,
            templateName,
          });
          const newTab = { id: note.id, templateId, templateName: note.templateName };
          setNoteTabs([newTab]);
          setActiveTab(`note:${note.id}`);
          setSelectedTemplateId(templateId);
          setActiveNoteContent(null);
        } else {
          setNoteTabs([]);
          setActiveTab("context");
          setActiveNoteContent(null);
        }
      } else {
        setNoteTabs((prev) => prev.filter((t) => t.id !== noteId));
        if (getNoteId(activeTab) === noteId) {
          setActiveTab("context");
          setActiveNoteContent(null);
        }
      }
    } catch (err) {
      console.error("Failed to delete note:", err);
    }
  }, [activeTab, noteTabs, activeSession]);

  if (!activeSession) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-gray-400">
        No active session. Create one to get started.
      </div>
    );
  }

  async function handleDelete() {
    if (!activeSession) return;
    try {
      await db.deleteSession(activeSession.id);
      setActiveSession(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete session");
    }
  }

  const field = getTabField(activeTab);
  // While streaming on the note tab, show the live preview; otherwise show persisted state
  const currentNoteId = getNoteId(activeTab);
  const noteIsStreaming = currentNoteId !== null && isStreaming && activeNoteId === currentNoteId && streamPreview;
  const initialState = noteIsStreaming
    ? streamPreview
    : getNoteId(activeTab) !== null
      ? activeNoteContent
      : ((activeSession[field] as SerializedEditorState | null) ?? null);
  const isLiveTranscribing = captureState === "recording" || isTranscribing;
  const hasCompletedTranscript = !!activeSession.rawTranscript && !isLiveTranscribing;
  const isReadOnly =
    (activeTab === "transcription" && !hasCompletedTranscript) ||
    (getNoteId(activeTab) !== null && (isStreaming || !hasCompletedTranscript));

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (activeTab !== "context") return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, [activeTab]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only hide overlay when leaving the container (not child elements)
    if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (activeTab !== "context" || !activeSession) return;
    if (!sidecarConnected) {
      setError("Sidecar not connected — cannot extract file text. Start the sidecar and try again.");
      return;
    }

    const files = Array.from(e.dataTransfer.files);
    const validExts = [".pdf", ".txt", ".csv", ".md"];
    const validFiles = files.filter((f) =>
      validExts.some((ext) => f.name.toLowerCase().endsWith(ext))
    );

    if (validFiles.length === 0) {
      setError("Only PDF and text files (.pdf, .txt, .csv, .md) are supported.");
      return;
    }

    // File size validation
    const oversized = validFiles.filter((f) => f.size > MAX_FILE_SIZE);
    if (oversized.length > 0) {
      setError(`File too large (max 50MB): ${oversized.map((f) => f.name).join(", ")}`);
      return;
    }
    const large = validFiles.filter((f) => f.size > WARN_FILE_SIZE);
    if (large.length > 0) {
      console.warn("Large files detected:", large.map((f) => `${f.name} (${(f.size / 1024 / 1024).toFixed(1)}MB)`));
    }

    // For Tauri drag-drop, the files have a path property
    // But standard HTML5 drag-drop doesn't give us the path
    // Tauri provides file paths via the dataTransfer
    const dataDir = await appDataDir();
    const attachDir = `${dataDir.endsWith("/") ? dataDir : dataDir + "/"}attachments/${activeSession.id}`;
    await mkdir(attachDir, { recursive: true });

    for (const file of validFiles) {
      // In Tauri, dropped files have a path accessible via webkitRelativePath or the file itself
      // We need to read the file content and write it to appData
      const destPath = `${attachDir}/${crypto.randomUUID()}_${file.name}`;
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const mimeType = ext === "pdf" ? "application/pdf" : "text/plain";

      try {
        // Read file as ArrayBuffer and write to dest
        const buffer = await file.arrayBuffer();
        const { writeFile } = await import("@tauri-apps/plugin-fs");
        await writeFile(destPath, new Uint8Array(buffer));

        const att = await db.createAttachment({
          sessionId: activeSession.id,
          fileName: file.name,
          fileSize: file.size,
          mimeType,
          extractedText: null,
          filePath: destPath,
        });

        setAttachments((prev) => [...prev, { ...att, _extracting: true }]);

        try {
          const text = await extractText(destPath);
          await db.updateAttachmentText(att.id, text);
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === att.id ? { ...a, extractedText: text, _extracting: false } : a
            )
          );
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "Extraction failed";
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === att.id ? { ...a, _extracting: false, _error: errMsg } : a
            )
          );
        }
      } catch (err) {
        console.error("Failed to handle dropped file:", err);
      }
    }
  }, [activeTab, activeSession, extractText, sidecarConnected]);

  const handleExportPDF = useCallback(async () => {
    // Flush any pending note save before exporting so the PDF uses the latest content
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const pending = pendingSaveRef.current;
    if (pending && pending.field.startsWith("note:")) {
      const nid = pending.field.slice(5);
      try { await db.updateSessionNote(nid, JSON.stringify(pending.state)); } catch (err) {
        console.error("Failed to flush pending note save before PDF export:", err);
      }
      pendingSaveRef.current = null;
    }

    // Use pending state only if it belongs to the currently active note tab;
    // otherwise fall back to activeNoteContent (the loaded content for the current tab).
    const currentNid = getNoteId(activeTab);
    const pendingIsForCurrentTab = pending?.field === `note:${currentNid}`;
    const noteContent = pendingIsForCurrentTab ? pending.state as SerializedEditorState : activeNoteContent;
    if (!noteContent) return;
    if (!sidecarConnected) {
      setError("Sidecar not connected — cannot generate PDF.");
      return;
    }

    setIsExporting(true);
    try {
      // Convert Lexical state to HTML
      const html = lexicalToHtml(noteContent);

      // Fetch provider data for footer
      const provider = await db.getProvider();

      // Generate PDF via sidecar
      const pdfBase64 = await generatePdf(
        html,
        {
          firstName: provider?.firstName,
          lastName: provider?.lastName,
          providerType: provider?.providerType,
          signature: provider?.signature,
        },
        activeSession.title
      );

      // Decode base64 to bytes
      const binaryStr = atob(pdfBase64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      // Show Save As dialog
      const defaultName = (activeSession.title ?? "note").replace(/[/\\?%*:|"<>]/g, "_");
      const savePath = await saveDialog({
        defaultPath: `${defaultName}.pdf`,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });

      if (!savePath) {
        // User cancelled
        return;
      }

      // Write file
      await writeFile(savePath, bytes);

      // Open in system viewer
      try {
        await openPath(savePath);
      } catch {
        // Non-critical — file was saved successfully
      }

      setToast({ message: "PDF exported successfully", variant: "success", visible: true });
    } catch (err) {
      console.error("PDF export failed:", err);
      const message = err instanceof Error ? err.message : "PDF export failed";
      setToast({ message, variant: "error", visible: true });
    } finally {
      setIsExporting(false);
    }
  }, [activeSession, activeTab, activeNoteContent, sidecarConnected, generatePdf]);

  return (
    <div
      className="flex h-full flex-col relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {captureError && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          {captureError}
        </div>
      )}

      {transcriptionError && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          {transcriptionError}
        </div>
      )}

      {noteError && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          {noteError}
        </div>
      )}

      <SessionTopBar
        session={activeSession}
        patients={patients}
        onPatientChange={handlePatientChange}
        onCreatePatient={() => setShowQuickPatient(true)}
        isRecording={captureState === "recording"}
        isTranscribing={isTranscribing}
        sidecarConnected={sidecarConnected}
        devices={devices}
        selectedDeviceId={selectedDeviceId}
        permissionState={permissionState}
        onSelectDevice={handleSelectDevice}
        onRequestPermission={requestPermission}
        audioPreviewStream={audioPreviewStream}
        recordingTime={recordingTime}
        onStart={handleStartRecording}
        onStop={handleStopRecording}
        confirmDelete={confirmDelete}
        onDeleteRequest={() => setConfirmDelete(true)}
        onDeleteConfirm={() => { setConfirmDelete(false); handleDelete(); }}
        onDeleteCancel={() => setConfirmDelete(false)}
        hasTranscript={hasCompletedTranscript}
        onAddNote={() => setShowAddNoteModal(true)}
      />

      <SessionTabBar
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          const nid = getNoteId(tab);
          if (nid) {
            const nt = noteTabs.find((n) => n.id === nid);
            if (nt) setSelectedTemplateId(nt.templateId);
          }
        }}
        locked={isLiveTranscribing}
        showTranscription={!!activeSession.rawTranscript || isLiveTranscribing}
        noteTabs={noteTabs}
        onAddNote={() => setShowAddNoteModal(true)}
        onNewSmartDictation={() => setShowAddNoteModal(true)}
        hasTranscript={hasCompletedTranscript}
      />

      {/* Patient context (read-only) — shown above editor on context tab */}
      {activeTab === "context" && patient?.context && (
        <div className="pt-4">
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Patient Context (read-only)
          </label>
          <div className="max-w-[800px] rounded-md border border-gray-200 bg-gray-50 px-3 py-2 font-[ui-sans-serif,system-ui,sans-serif] text-base text-gray-700 whitespace-pre-wrap">
            {patient.context}
          </div>
        </div>
      )}

      <div className={`min-h-0 flex-1 pt-2${!showEntityHighlights ? " entity-highlights-off" : ""}`}>
        {noteLoading && getNoteId(activeTab) !== null ? (
          <div className="flex items-center justify-center py-16 text-sm text-gray-400">
            Loading note...
          </div>
        ) : (
          <SessionEditor
            key={noteIsStreaming ? `note-streaming-${activeNoteId}` : `${activeSession.id}-${activeTab}`}
            initialState={initialState}
            onChange={isReadOnly ? undefined : handleEditorChange}
            readOnly={isReadOnly}
            streaming={!!noteIsStreaming}
            placeholder={
              getNoteId(activeTab) !== null && !hasCompletedTranscript
                ? "Create a transcription first to generate a note..."
                : getTabPlaceholder(activeTab)
            }
            header={
              getNoteId(activeTab) !== null
                ? confirmRegenerate
                  ? (
                    <div className="flex items-center justify-end gap-2 px-4 pt-3">
                      <span className="text-sm text-gray-500">Replace existing note?</span>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmRegenerate(false);
                          { const nid = getNoteId(activeTab); if (nid) generateNote(activeSession.id, nid, activeSession.rawTranscript ?? "", getTemplateTextForNote(nid), getContextText()); }
                        }}
                        className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                      >
                        Yes, replace
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmRegenerate(false)}
                        className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
                      >
                        Cancel
                      </button>
                    </div>
                  )
                  : (
                    <NoteToolbar
                      hasNote={!!activeNoteContent}
                      isGenerating={isGenerating}
                      isExporting={isExporting}
                      canGenerate={!!activeSession.rawTranscript}
                      templates={templates}
                      selectedTemplateId={selectedTemplateId}
                      onTemplateChange={(templateId) => {
                        setSelectedTemplateId(templateId);
                        // Sync the note tab's templateId so regeneration uses the correct template
                        const nid = getNoteId(activeTab);
                        if (nid) {
                          const tmpl = templates.find((t) => t.id === templateId);
                          const newName = tmpl?.name ?? "Note";
                          setNoteTabs((prev) =>
                            prev.map((t) =>
                              t.id === nid ? { ...t, templateId, templateName: newName } : t,
                            ),
                          );
                          db.updateSessionNoteTemplate(nid, templateId, newName);
                          // Auto-regenerate note with the new template
                          const transcript = activeSession.rawTranscript ?? "";
                          if (transcript) {
                            let templateText = "";
                            if (tmpl?.content) {
                              try { templateText = extractTextFromLexical(tmpl.content as SerializedEditorState, { markdown: true }); } catch { /* ignore */ }
                            }
                            generateNote(activeSession.id, nid, transcript, templateText, getContextText());
                          }
                        }
                      }}
                      onExportPDF={handleExportPDF}
                      showEntityHighlights={showEntityHighlights}
                      onToggleEntityHighlights={toggleEntityHighlights}
                      onCopy={() => {
                        if (!activeNoteContent) return;
                        try {
                          const text = extractTextFromLexical(activeNoteContent);
                          navigator.clipboard.writeText(text);
                        } catch (err) {
                          console.error("Failed to copy note:", err);
                        }
                      }}
                      onRegenerate={() => {
                        if (activeNoteContent) {
                          setConfirmRegenerate(true);
                        } else {
                          { const nid = getNoteId(activeTab); if (nid) generateNote(activeSession.id, nid, activeSession.rawTranscript ?? "", getTemplateTextForNote(nid), getContextText()); }
                        }
                      }}
                      onDelete={() => {
                        const nid = getNoteId(activeTab);
                        if (nid) setConfirmDeleteNote(nid);
                      }}
                    />
                  )
                : undefined
            }
          />
        )}
      </div>

      {/* Attachments toolbar — shown at bottom of context tab */}
      {activeTab === "context" && (
        <ContextAttachments
          attachments={attachments}
          onAttach={handleAttach}
          onRemove={handleRemoveAttachment}
        />
      )}

      {/* Drop zone overlay */}
      {isDragOver && activeTab === "context" && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center rounded-lg border-2 border-dashed border-primary/50 bg-primary/5">
          <div className="rounded-lg bg-white px-6 py-4 shadow-lg">
            <p className="text-sm font-medium text-gray-700">
              Drop PDF or text files here
            </p>
          </div>
        </div>
      )}

      {/* Quick patient creation modal */}
      {providerId && (
        <QuickPatientModal
          open={showQuickPatient}
          onClose={() => setShowQuickPatient(false)}
          providerId={providerId}
          onCreated={handlePatientCreated}
        />
      )}

      {/* Template selector for adding new note tabs */}
      <TemplateSelectorModal
        open={showAddNoteModal}
        onClose={() => setShowAddNoteModal(false)}
        templates={templates}
        selectedTemplateId={selectedTemplateId}
        onSelect={handleAddNote}
      />

      {/* Confirm delete note */}
      <ConfirmModal
        open={!!confirmDeleteNote}
        onClose={() => setConfirmDeleteNote(null)}
        onConfirm={() => confirmDeleteNote && handleDeleteNote(confirmDeleteNote)}
        title="Delete note?"
        message="This will permanently delete this note. This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Toast notification */}
      <Toast
        message={toast.message}
        visible={toast.visible}
        variant={toast.variant}
        onDismiss={() => setToast((t) => ({ ...t, visible: false }))}
      />
    </div>
  );
}
