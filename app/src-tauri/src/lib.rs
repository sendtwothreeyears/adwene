mod sidecar;

use sidecar::SidecarState;
use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_provider_table",
            sql: include_str!("../migrations/001_create_provider.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_patient_table",
            sql: include_str!("../migrations/002_create_patient.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "create_template_table",
            sql: include_str!("../migrations/003_create_template.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "create_session_table",
            sql: include_str!("../migrations/004_create_session.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "add_raw_transcript_to_session",
            sql: include_str!("../migrations/005_add_raw_transcript.sql"),
            kind: MigrationKind::Up,
        },
    ];

    let app = tauri::Builder::default()
        .manage(SidecarState::default())
        .setup(|app| {
            let state = app.state::<SidecarState>();
            sidecar::start_sidecar(&state);
            Ok(())
        })
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:adwene.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .build(tauri::generate_context!())
        .expect("error building tauri application");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            let state = app_handle.state::<SidecarState>();
            sidecar::stop_sidecar(&state);
        }
    });
}
