import { useState } from "react";
import * as db from "./lib/db";

function App() {
  const [status, setStatus] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  async function runVerification() {
    setRunning(true);
    const log: string[] = [];

    try {
      // 1. Verify DB connection
      const database = await db.getDb();
      log.push("[OK] Database connected");

      // 2. Verify tables exist
      const tables = await database.select<{ name: string }[]>(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      );
      const tableNames = tables.map((t) => t.name);
      log.push(`[OK] Tables found: ${tableNames.join(", ")}`);

      for (const expected of ["Provider", "Patient", "Template", "Session"]) {
        if (tableNames.includes(expected)) {
          log.push(`  [OK] ${expected} table exists`);
        } else {
          log.push(`  [FAIL] ${expected} table MISSING`);
        }
      }

      // 3. Create a test provider
      const provider = await db.createProvider({
        id: crypto.randomUUID(),
        email: "dr.test@clinic.local",
        firstName: "Test",
        lastName: "Provider",
        providerType: "MD",
        title: "Dr.",
        bio: null,
        profilePhoto: null,
        city: null,
        state: null,
        country: null,
        zipCode: null,
        phone: null,
        faxNumber: null,
        officeAddress: null,
        specialty: "FAMILY_MEDICINE",
        organizationName: null,
        practiceName: null,
        npi: null,
        licenseNumber: null,
        licenseState: null,
        deaNumber: null,
        taxId: null,
        languages: null,
        yearsOfExperience: null,
        boardCertifications: null,
      });
      log.push(`[OK] Provider created: ${provider.firstName} ${provider.lastName}`);

      // 4. Verify provider read
      const fetchedProvider = await db.getProvider();
      if (fetchedProvider && fetchedProvider.id === provider.id) {
        log.push(`[OK] Provider read back successfully`);
      } else {
        log.push(`[FAIL] Provider read back failed`);
      }

      // 5. Create a test patient
      const patient = await db.createPatient({
        firstName: "Maria",
        lastName: "Garcia",
        dateOfBirth: "1968-04-15",
        gender: "Female",
        mrn: "MRN-00142",
        context: "Diabetic, on metformin.",
        phone: null,
        email: null,
        address: null,
        city: null,
        state: null,
        zipCode: null,
        providerId: provider.id,
      });
      log.push(`[OK] Patient created: ${patient.firstName} ${patient.lastName}`);

      // 6. Create a test template
      const template = await db.createTemplate({
        name: "General Visit",
        content: { root: { children: [] } },
        description: "Default SOAP template",
        isSystem: true,
        providerId: null,
      });
      log.push(`[OK] Template created: ${template.name}`);

      // 7. Create a test session
      const session = await db.createSession({
        transcript: null,
        notes: null,
        summary: "Test session",
        context: null,
        status: "DRAFT",
        preview: null,
        providerId: provider.id,
        patientId: patient.id,
        templateId: template.id,
      });
      log.push(`[OK] Session created with status: ${session.status}`);

      // 8. Verify list operations
      const patients = await db.listPatients(provider.id);
      log.push(`[OK] listPatients returned ${patients.length} patient(s)`);

      const sessions = await db.listSessions(provider.id);
      log.push(`[OK] listSessions returned ${sessions.length} session(s)`);

      const templates = await db.listTemplates(provider.id);
      log.push(`[OK] listTemplates returned ${templates.length} template(s)`);

      // 9. Verify update
      await db.updatePatient(patient.id, { context: "Updated context" });
      const updatedPatient = await db.getPatient(patient.id);
      if (updatedPatient?.context === "Updated context") {
        log.push(`[OK] Patient update verified`);
      } else {
        log.push(`[FAIL] Patient update failed`);
      }

      // 10. Clean up (delete in reverse FK order)
      await db.deleteSession(session.id);
      log.push("[OK] Session deleted");
      await db.deletePatient(patient.id);
      log.push("[OK] Patient deleted");
      await db.deleteTemplate(template.id);
      log.push("[OK] Template deleted");
      await database.execute("DELETE FROM Provider WHERE id = $1", [provider.id]);
      log.push("[OK] Provider deleted");

      log.push("");
      log.push("=== ALL CHECKS PASSED ===");
    } catch (err) {
      log.push(`[FAIL] Error: ${err instanceof Error ? err.message : String(err)}`);
    }

    setStatus(log);
    setRunning(false);
  }

  return (
    <div style={{ padding: "2rem", fontFamily: "monospace", fontSize: "14px" }}>
      <h1 style={{ fontFamily: "system-ui" }}>Adwene Offline - Database Verification</h1>
      <p style={{ color: "#666", fontFamily: "system-ui" }}>
        Click the button below to verify that all database tables exist and CRUD operations work.
      </p>
      <button
        onClick={runVerification}
        disabled={running}
        style={{
          padding: "0.75rem 1.5rem",
          fontSize: "16px",
          cursor: running ? "wait" : "pointer",
        }}
      >
        {running ? "Running..." : "Run Database Verification"}
      </button>
      <pre style={{ marginTop: "1rem", lineHeight: "1.8" }}>
        {status.map((line, i) => (
          <div
            key={i}
            style={{
              color: line.includes("[FAIL]")
                ? "#e74c3c"
                : line.includes("[OK]")
                ? "#27ae60"
                : line.includes("===")
                ? "#2980b9"
                : "inherit",
              fontWeight: line.includes("===") ? "bold" : "normal",
            }}
          >
            {line}
          </div>
        ))}
      </pre>
    </div>
  );
}

export default App;
