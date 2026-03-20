mod auth;
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
        Migration {
            version: 6,
            description: "create_attachment_table",
            sql: include_str!("../migrations/006_create_attachment.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "add_is_favourite_to_template",
            sql: include_str!("../migrations/007_add_is_favourite_to_template.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "add_provider_onboarding_columns",
            sql: include_str!("../migrations/008_provider_onboarding_columns.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "add_default_template_to_provider",
            sql: include_str!("../migrations/009_add_default_template.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 10,
            description: "add_signature_to_provider",
            sql: include_str!("../migrations/010_add_signature.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 11,
            description: "add_title_to_session",
            sql: include_str!("../migrations/011_add_title_to_session.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 12,
            description: "create_tags_tables",
            sql: include_str!("../migrations/012_create_tags.sql"),
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
        .invoke_handler(tauri::generate_handler![
            auth::hash_password,
            auth::verify_password,
        ])
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .build(tauri::generate_context!())
        .expect("error building tauri application");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            let state = app_handle.state::<SidecarState>();
            sidecar::stop_sidecar(&state);
        }
    });
}
