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
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:adwene.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
