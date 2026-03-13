/**
 * System template definitions and seeding logic.
 * Uses @lexical/headless to generate editor state — same approach as the server.
 */

import { createHeadlessEditor } from "@lexical/headless";
import { $getRoot, $createParagraphNode, $createTextNode } from "lexical";
import { ListNode, ListItemNode } from "@lexical/list";
import { LinkNode } from "@lexical/link";
import { CodeNode } from "@lexical/code";
import { HeadingNode, $createHeadingNode } from "@lexical/rich-text";
import * as db from "./db";

// Lexical node types the app supports (matches server/utils/editor/lexicalNodes.ts)
const LEXICAL_NODES = [ListNode, ListItemNode, LinkNode, CodeNode, HeadingNode];

type TemplateLine = { type: "heading" | "paragraph"; text: string; level?: 1 | 2 | 3 };

// ---------------------------------------------------------------------------
// Lexical state generation
// ---------------------------------------------------------------------------

async function createEditorStateFromLines(lines: TemplateLine[]) {
  const editor = createHeadlessEditor({
    nodes: LEXICAL_NODES,
    onError: (error: Error) => {
      throw error;
    },
  });

  await editor.update(() => {
    const root = $getRoot();
    root.clear();

    for (const line of lines) {
      if (line.type === "heading") {
        const tag = `h${line.level ?? 1}` as "h1" | "h2" | "h3" | "h4" | "h5";
        const heading = $createHeadingNode(tag);
        heading.append($createTextNode(line.text));
        root.append(heading);
      } else {
        const paragraph = $createParagraphNode();
        if (line.text) {
          paragraph.append($createTextNode(line.text));
        }
        root.append(paragraph);
      }
    }
  });

  return editor.getEditorState().toJSON();
}

// ---------------------------------------------------------------------------
// Template line definitions (mirrored from server/utils/editor/)
// ---------------------------------------------------------------------------

const SOAP_LINES: TemplateLine[] = [
  { type: "heading", text: "Subjective", level: 1 },
  { type: "heading", text: "Chief Complaint", level: 2 },
  { type: "paragraph", text: "[Patient's primary reason for visit]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "History of Present Illness", level: 2 },
  { type: "paragraph", text: "[Detailed description of current problem including onset, duration, severity, location, quality, timing, context, modifying factors, and associated symptoms]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Review of Systems", level: 2 },
  { type: "paragraph", text: "(Only include systems that were discussed. If not mentioned, omit this section entirely)" },
  { type: "paragraph", text: "Constitutional: [Fever, chills, fatigue, weight changes]" },
  { type: "paragraph", text: "HEENT: [Vision, hearing, throat, nasal symptoms]" },
  { type: "paragraph", text: "Cardiovascular: [Chest pain, palpitations, edema]" },
  { type: "paragraph", text: "Respiratory: [Shortness of breath, cough, wheezing]" },
  { type: "paragraph", text: "Gastrointestinal: [Nausea, vomiting, diarrhea, abdominal pain]" },
  { type: "paragraph", text: "Genitourinary: [Urinary symptoms, menstrual history]" },
  { type: "paragraph", text: "Musculoskeletal: [Joint pain, muscle weakness, mobility issues]" },
  { type: "paragraph", text: "Neurological: [Headache, dizziness, numbness, weakness]" },
  { type: "paragraph", text: "Psychiatric: [Mood, anxiety, sleep]" },
  { type: "paragraph", text: "Skin: [Rashes, lesions, wounds]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Past Medical History", level: 2 },
  { type: "paragraph", text: "[Chronic conditions and prior diagnoses]" },
  { type: "paragraph", text: '(If not discussed, state "Not discussed")' },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Medications", level: 2 },
  { type: "paragraph", text: "[Current medications with dosages]" },
  { type: "paragraph", text: '(If not discussed, state "Not discussed")' },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Allergies", level: 2 },
  { type: "paragraph", text: "[Drug allergies and reactions]" },
  { type: "paragraph", text: '(If not discussed, state "No known drug allergies discussed" or "Not discussed")' },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Social History", level: 2 },
  { type: "paragraph", text: "Tobacco: [Usage details]" },
  { type: "paragraph", text: "Alcohol: [Usage details]" },
  { type: "paragraph", text: "Recreational drugs: [Usage details]" },
  { type: "paragraph", text: "Occupation: [Job details]" },
  { type: "paragraph", text: "(Only include items that were mentioned)" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Family History", level: 2 },
  { type: "paragraph", text: "[Relevant family medical history]" },
  { type: "paragraph", text: '(If not discussed, state "Not discussed")' },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Objective", level: 1 },
  { type: "heading", text: "Physical Examination", level: 2 },
  { type: "heading", text: "Vital Signs:", level: 3 },
  { type: "paragraph", text: "BP: [Blood pressure]" },
  { type: "paragraph", text: "HR: [Heart rate]" },
  { type: "paragraph", text: "Temp: [Temperature]" },
  { type: "paragraph", text: "RR: [Respiratory rate]" },
  { type: "paragraph", text: "SpO2: [Oxygen saturation]" },
  { type: "paragraph", text: "(Only include vitals that were documented)" },
  { type: "paragraph", text: "" },
  { type: "paragraph", text: "General: [Overall appearance and condition]" },
  { type: "paragraph", text: '(Only document examination findings that were explicitly mentioned. If no physical exam was performed, state "Physical examination not documented")' },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Assessment", level: 1 },
  { type: "paragraph", text: "[Primary diagnosis or clinical impression]" },
  { type: "paragraph", text: "[Secondary diagnoses if applicable]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Plan", level: 1 },
  { type: "paragraph", text: "1. [Diagnostic workup - labs, imaging, referrals]" },
  { type: "paragraph", text: "2. [Therapeutic interventions - medications, procedures]" },
  { type: "paragraph", text: "3. [Patient education and counseling provided]" },
  { type: "paragraph", text: "4. [Follow-up instructions]" },
  { type: "paragraph", text: "(Only include plan elements that were specifically discussed)" },
  { type: "paragraph", text: "" },
];

const HP_LINES: TemplateLine[] = [
  { type: "heading", text: "Patient Information", level: 1 },
  { type: "paragraph", text: "Date of Encounter: [Date]" },
  { type: "paragraph", text: "Chief Complaint: [Primary reason for visit]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "History of Present Illness", level: 2 },
  { type: "paragraph", text: "[Comprehensive narrative of current problem including: onset, duration, character, location, radiation, severity (1-10), timing, context, modifying factors, associated symptoms, previous treatments, and patient's understanding]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Past Medical History", level: 2 },
  { type: "paragraph", text: "[All chronic conditions, prior hospitalizations, surgeries, injuries, and significant illnesses with dates]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Medications", level: 2 },
  { type: "paragraph", text: "[Complete list with drug name, dose, route, frequency, and indication]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Allergies", level: 2 },
  { type: "paragraph", text: "[Drug allergies with specific reactions; environmental and food allergies if relevant]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Social History", level: 2 },
  { type: "paragraph", text: "Tobacco: [Type, amount, duration, pack-years]" },
  { type: "paragraph", text: "Alcohol: [Type, amount, frequency, CAGE if indicated]" },
  { type: "paragraph", text: "Recreational drugs: [Type, route, frequency, last use]" },
  { type: "paragraph", text: "Occupation: [Current and past relevant occupations]" },
  { type: "paragraph", text: "Living situation: [Home environment, support system]" },
  { type: "paragraph", text: "Exercise: [Type, frequency, duration]" },
  { type: "paragraph", text: "Diet: [Typical diet, restrictions]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Family History", level: 2 },
  { type: "paragraph", text: "[Detailed family history including age and health of parents, siblings, children; focus on conditions relevant to patient's presentation: cardiac disease, cancer, diabetes, hypertension, psychiatric conditions, genetic disorders]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Review of Systems", level: 2 },
  { type: "paragraph", text: "Constitutional: [Fever, chills, night sweats, weight changes, fatigue, malaise]" },
  { type: "paragraph", text: "HEENT: [Headaches, vision changes, hearing loss, tinnitus, epistaxis, sinus problems, dental issues, sore throat]" },
  { type: "paragraph", text: "Cardiovascular: [Chest pain, palpitations, orthopnea, PND, edema, claudication, syncope]" },
  { type: "paragraph", text: "Respiratory: [Dyspnea, cough, sputum, hemoptysis, wheezing, sleep apnea]" },
  { type: "paragraph", text: "Gastrointestinal: [Appetite, nausea, vomiting, dysphagia, heartburn, abdominal pain, bowel habits, melena, hematochezia]" },
  { type: "paragraph", text: "Genitourinary: [Dysuria, frequency, urgency, hematuria, nocturia, incontinence, sexual function; for females: LMP, contraception, pregnancies, menstrual history]" },
  { type: "paragraph", text: "Musculoskeletal: [Joint pain, stiffness, swelling, weakness, back pain, trauma, limitations in ADLs]" },
  { type: "paragraph", text: "Skin: [Rashes, lesions, changes in moles, pruritus, wounds, bruising]" },
  { type: "paragraph", text: "Neurological: [Seizures, stroke, weakness, numbness, tremor, gait disturbance, memory problems]" },
  { type: "paragraph", text: "Psychiatric: [Mood, anxiety, depression, sleep disturbances, concentration, suicidal ideation]" },
  { type: "paragraph", text: "Endocrine: [Polyuria, polydipsia, heat/cold intolerance, thyroid disease]" },
  { type: "paragraph", text: "Hematologic: [Anemia, bleeding tendencies, lymphadenopathy, transfusions]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Physical Examination", level: 1 },
  { type: "heading", text: "Vital Signs:", level: 3 },
  { type: "paragraph", text: "BP: [Include both arms if indicated]" },
  { type: "paragraph", text: "HR: [Rate and rhythm]" },
  { type: "paragraph", text: "Temp: [Route]" },
  { type: "paragraph", text: "RR: [Rate and pattern]" },
  { type: "paragraph", text: "SpO2: [On room air or supplemental O2]" },
  { type: "paragraph", text: "Height: [cm/inches]" },
  { type: "paragraph", text: "Weight: [kg/lbs]" },
  { type: "paragraph", text: "BMI: [calculated]" },
  { type: "paragraph", text: "" },
  { type: "paragraph", text: "General: [Appearance, distress, nutritional status, grooming]" },
  { type: "paragraph", text: "HEENT: [Head, eyes, ears, nose, throat - including fundoscopic, PERRLA, TMs, oropharynx]" },
  { type: "paragraph", text: "Neck: [Thyroid, JVP, carotids, lymph nodes, ROM]" },
  { type: "paragraph", text: "Cardiovascular: [Rate, rhythm, murmurs, rubs, gallops, peripheral pulses, edema]" },
  { type: "paragraph", text: "Respiratory: [Effort, breath sounds, symmetry, percussion, tactile fremitus]" },
  { type: "paragraph", text: "Abdominal: [Bowel sounds, soft/tender, masses, hepatosplenomegaly, rebound, guarding]" },
  { type: "paragraph", text: "Musculoskeletal: [Joints, ROM, deformities, gait, spine]" },
  { type: "paragraph", text: "Skin: [Color, temperature, turgor, lesions, wounds]" },
  { type: "paragraph", text: "Neurological: [Mental status, cranial nerves, motor, sensory, reflexes, coordination, gait]" },
  { type: "paragraph", text: "Psychiatric: [Appearance, behavior, mood, affect, thought process, thought content, insight, judgment]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Assessment and Plan", level: 1 },
  { type: "paragraph", text: "[Synthesized assessment with differential diagnosis, clinical reasoning, and comprehensive plan organized by problem]" },
  { type: "paragraph", text: "" },
  { type: "paragraph", text: "Problem #1: [Diagnosis or problem]" },
  { type: "paragraph", text: "   Assessment: [Clinical reasoning]" },
  { type: "paragraph", text: "   Plan: [Specific interventions, medications, tests, referrals, follow-up]" },
  { type: "paragraph", text: "" },
  { type: "paragraph", text: "Problem #2: [If applicable]" },
  { type: "paragraph", text: "   Assessment: [Clinical reasoning]" },
  { type: "paragraph", text: "   Plan: [Specific interventions]" },
  { type: "paragraph", text: "" },
];

const PROGRESS_NOTE_LINES: TemplateLine[] = [
  { type: "heading", text: "Progress Note", level: 1 },
  { type: "paragraph", text: "Date: [Date of visit]" },
  { type: "paragraph", text: "Interval History: [Changes since last visit]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Subjective", level: 2 },
  { type: "paragraph", text: "[Patient's report of symptoms, response to treatment, new concerns]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Objective", level: 2 },
  { type: "heading", text: "Vital Signs:", level: 3 },
  { type: "paragraph", text: "BP: [Blood pressure]" },
  { type: "paragraph", text: "HR: [Heart rate]" },
  { type: "paragraph", text: "Temp: [Temperature]" },
  { type: "paragraph", text: "Weight: [If relevant]" },
  { type: "paragraph", text: "" },
  { type: "paragraph", text: "Physical Exam: [Focused exam relevant to current problems]" },
  { type: "paragraph", text: "" },
  { type: "paragraph", text: "Labs/Studies: [Recent results if applicable]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Assessment", level: 2 },
  { type: "paragraph", text: "[Current status of each problem with stability/improvement/worsening]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Plan", level: 2 },
  { type: "paragraph", text: "[Continue, adjust, or discontinue treatments]" },
  { type: "paragraph", text: "[New interventions]" },
  { type: "paragraph", text: "[Follow-up timing and conditions]" },
  { type: "paragraph", text: "" },
];

const DC_SUMMARY_LINES: TemplateLine[] = [
  { type: "heading", text: "Discharge Summary", level: 1 },
  { type: "paragraph", text: "Date of Admission: [Date]" },
  { type: "paragraph", text: "Date of Discharge: [Date]" },
  { type: "paragraph", text: "Length of Stay: [Days]" },
  { type: "paragraph", text: "Attending Physician: [Name]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Admitting Diagnosis", level: 2 },
  { type: "paragraph", text: "[Primary reason for admission]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Discharge Diagnosis", level: 2 },
  { type: "paragraph", text: "Primary: [Main diagnosis]" },
  { type: "paragraph", text: "Secondary: [Additional diagnoses]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "History of Present Illness", level: 2 },
  { type: "paragraph", text: "[Brief summary of presentation and reason for admission]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Hospital Course", level: 2 },
  { type: "paragraph", text: "[Narrative of patient's clinical course during hospitalization, organized by problem or chronologically. Include significant events, procedures, consultations, complications, and response to treatment]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Procedures Performed", level: 2 },
  { type: "paragraph", text: "[List all procedures with dates]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Consultations", level: 2 },
  { type: "paragraph", text: "[Consulting services and key recommendations]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Significant Labs/Studies", level: 2 },
  { type: "paragraph", text: "[Key diagnostic results]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Discharge Condition", level: 2 },
  { type: "paragraph", text: "Condition: [Stable/improved/fair/guarded]" },
  { type: "paragraph", text: "Activity: [Restrictions or limitations]" },
  { type: "paragraph", text: "Diet: [Dietary recommendations]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Discharge Medications", level: 2 },
  { type: "paragraph", text: "[Complete list with drug name, dose, route, frequency, indication]" },
  { type: "paragraph", text: "[Specify any changes from home medications]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Follow-up", level: 2 },
  { type: "paragraph", text: "Primary Care: [Provider name, timeframe]" },
  { type: "paragraph", text: "Specialists: [Provider name, timeframe]" },
  { type: "paragraph", text: "Pending Studies: [Tests awaiting results]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Patient Instructions", level: 2 },
  { type: "paragraph", text: "[Activity restrictions, wound care, medication instructions, warning signs, when to seek emergency care]" },
  { type: "paragraph", text: "" },
];

const PROCEDURE_NOTE_LINES: TemplateLine[] = [
  { type: "heading", text: "Procedure Note", level: 1 },
  { type: "paragraph", text: "Date: [Date and time]" },
  { type: "paragraph", text: "Procedure: [Name of procedure]" },
  { type: "paragraph", text: "Operator: [Performing physician]" },
  { type: "paragraph", text: "Assistant(s): [Names if applicable]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Indication", level: 2 },
  { type: "paragraph", text: "[Clinical reason for procedure]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Consent", level: 2 },
  { type: "paragraph", text: "[Informed consent obtained; risks, benefits, alternatives discussed]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Pre-Procedure Assessment", level: 2 },
  { type: "heading", text: "Vital Signs:", level: 3 },
  { type: "paragraph", text: "BP: [Blood pressure]" },
  { type: "paragraph", text: "HR: [Heart rate]" },
  { type: "paragraph", text: "SpO2: [Oxygen saturation]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Anesthesia/Sedation", level: 2 },
  { type: "paragraph", text: "[Type and amount of anesthesia/sedation used]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Procedure Details", level: 2 },
  { type: "paragraph", text: "[Step-by-step description: patient position, site preparation, sterilization technique, procedural steps, equipment used, findings]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Specimens", level: 2 },
  { type: "paragraph", text: "[Specimens obtained and disposition]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Estimated Blood Loss", level: 2 },
  { type: "paragraph", text: "[Amount if significant]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Complications", level: 2 },
  { type: "paragraph", text: "[None, or describe any complications]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Post-Procedure Assessment", level: 2 },
  { type: "paragraph", text: "Patient tolerated procedure: [Well/poorly]" },
  { type: "paragraph", text: "Post-procedure vitals: [If obtained]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Disposition", level: 2 },
  { type: "paragraph", text: "[Disposition and follow-up plan]" },
  { type: "paragraph", text: "" },
];

const CONSULTATION_NOTE_LINES: TemplateLine[] = [
  { type: "heading", text: "Consultation Note", level: 1 },
  { type: "paragraph", text: "Date of Consultation: [Date]" },
  { type: "paragraph", text: "Requesting Service: [Service/physician name]" },
  { type: "paragraph", text: "Consulting Service: [Your service/specialty]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Reason for Consultation", level: 2 },
  { type: "paragraph", text: "[Specific question or concern from requesting provider]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "History of Present Illness", level: 2 },
  { type: "paragraph", text: "[Focused on the consultation question; include relevant timeline]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Pertinent Past Medical History", level: 2 },
  { type: "paragraph", text: "[Relevant to consultation question]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Current Medications", level: 2 },
  { type: "paragraph", text: "[Medications relevant to consultation]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Allergies", level: 2 },
  { type: "paragraph", text: "[Drug allergies]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Pertinent Review of Systems", level: 2 },
  { type: "paragraph", text: "[Focused ROS relevant to consultation]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Physical Examination", level: 2 },
  { type: "heading", text: "Vital Signs:", level: 3 },
  { type: "paragraph", text: "[Current vitals]" },
  { type: "paragraph", text: "" },
  { type: "paragraph", text: "[Focused examination relevant to consultation question]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Pertinent Labs/Studies", level: 2 },
  { type: "paragraph", text: "[Relevant diagnostic data]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Assessment", level: 2 },
  { type: "paragraph", text: "[Clinical assessment addressing the consultation question]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Recommendations", level: 2 },
  { type: "paragraph", text: "[Numbered list of specific recommendations]" },
  { type: "paragraph", text: "1. [Recommendation]" },
  { type: "paragraph", text: "2. [Recommendation]" },
  { type: "paragraph", text: "3. [Recommendation]" },
  { type: "paragraph", text: "" },
  { type: "paragraph", text: "Thank you for this consultation. Will follow as needed." },
  { type: "paragraph", text: "" },
];

const DAP_LINES: TemplateLine[] = [
  { type: "heading", text: "DAP Note", level: 1 },
  { type: "paragraph", text: "Date: [Date of session]" },
  { type: "paragraph", text: "Session Type: [Individual/Family/Group]" },
  { type: "paragraph", text: "Duration: [Minutes]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Data", level: 2 },
  { type: "paragraph", text: "[Objective observations: appearance, behavior, mood, affect, speech, thought process, thought content, attention, memory, insight, judgment]" },
  { type: "paragraph", text: "" },
  { type: "paragraph", text: "[Subjective information: client's self-report, presenting concerns, symptoms, stressors, progress on goals]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Assessment", level: 2 },
  { type: "paragraph", text: "[Clinical interpretation of data: progress toward treatment goals, changes in symptoms, clinical impressions, response to interventions, risk assessment]" },
  { type: "paragraph", text: "" },
  { type: "heading", text: "Plan", level: 2 },
  { type: "paragraph", text: "[Specific interventions used in session]" },
  { type: "paragraph", text: "[Homework or between-session tasks]" },
  { type: "paragraph", text: "[Modifications to treatment plan if needed]" },
  { type: "paragraph", text: "[Next appointment scheduled]" },
  { type: "paragraph", text: "" },
];

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

const SYSTEM_TEMPLATES = [
  { id: "soap", name: "SOAP Note", description: "Subjective, Objective, Assessment, Plan - Standard medical documentation format", lines: SOAP_LINES },
  { id: "hp", name: "H&P (History & Physical)", description: "Comprehensive initial patient evaluation with detailed history and physical examination", lines: HP_LINES },
  { id: "progress", name: "Progress Note", description: "Follow-up visit documentation for established patients", lines: PROGRESS_NOTE_LINES },
  { id: "dc-summary", name: "Discharge Summary", description: "Comprehensive summary of hospital or facility stay", lines: DC_SUMMARY_LINES },
  { id: "procedure", name: "Procedure Note", description: "Documentation of procedures performed", lines: PROCEDURE_NOTE_LINES },
  { id: "consultation", name: "Consultation Note", description: "Specialist consultation and recommendations", lines: CONSULTATION_NOTE_LINES },
  { id: "dap", name: "DAP Note", description: "Data, Assessment, Plan - Common format for counseling and therapy sessions", lines: DAP_LINES },
];

/**
 * Seed system templates into the local database if they don't already exist.
 * Called once during app initialization. Checks by name to avoid duplicates.
 */
export async function seedSystemTemplates(): Promise<void> {
  // listTemplates includes system templates (isSystem=1) for any providerId
  const existing = await db.listTemplates("__seed_check__");
  const existingNames = new Set(
    existing.filter((t) => t.isSystem).map((t) => t.name),
  );

  for (const tmpl of SYSTEM_TEMPLATES) {
    if (existingNames.has(tmpl.name)) continue;

    const content = await createEditorStateFromLines(tmpl.lines);
    await db.createTemplate({
      name: tmpl.name,
      description: tmpl.description,
      content,
      isSystem: true,
      providerId: null,
    });
  }
}
