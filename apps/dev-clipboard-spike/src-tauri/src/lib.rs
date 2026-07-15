use std::{
    sync::atomic::{AtomicBool, AtomicU64, Ordering},
    thread,
    time::Duration,
};

use tauri::{LogicalPosition, LogicalSize, Manager, WebviewWindow, WindowEvent};
use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut, ShortcutState};

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct SourceApplication {
    name: String,
    bundle_id: String,
}

#[tauri::command]
fn frontmost_application() -> Option<SourceApplication> {
    #[cfg(target_os = "macos")]
    {
        use objc2_app_kit::NSWorkspace;

        let workspace = NSWorkspace::sharedWorkspace();
        let application = workspace
            .frontmostApplication()
            .or_else(|| workspace.menuBarOwningApplication())?;
        return Some(SourceApplication {
            name: application
                .localizedName()
                .map(|name| name.to_string())
                .unwrap_or_else(|| "Unknown app".to_string()),
            bundle_id: application
                .bundleIdentifier()
                .map(|identifier| identifier.to_string())
                .unwrap_or_default(),
        });
    }

    #[cfg(not(target_os = "macos"))]
    None
}

static PANEL_VISIBLE: AtomicBool = AtomicBool::new(true);
static PANEL_ANIMATION_ID: AtomicU64 = AtomicU64::new(0);
const PANEL_WIDTH: f64 = 580.0;
const PANEL_MARGIN: f64 = 20.0;
const PANEL_SHOW_STEPS: u64 = 14;
const PANEL_HIDE_STEPS: u64 = 21;
const PANEL_ANIMATION_FRAME_MS: u64 = 10;

fn panel_shortcut() -> Shortcut {
    Shortcut::new(Some(Modifiers::SUPER.union(Modifiers::ALT)), Code::KeyV)
}

fn panel_metrics(window: &WebviewWindow) -> (f64, f64, f64) {
    let monitor = window
        .primary_monitor()
        .ok()
        .flatten()
        .or_else(|| window.current_monitor().ok().flatten());

    if let Some(monitor) = monitor {
        let scale_factor = monitor.scale_factor();
        let work_area = monitor.work_area();
        let position = work_area.position.to_logical::<f64>(scale_factor);
        let size = work_area.size.to_logical::<f64>(scale_factor);
        let visible_x = position.x + PANEL_MARGIN;
        let visible_y = position.y + PANEL_MARGIN;
        let height = (size.height - PANEL_MARGIN * 2.0).max(520.0);

        return (visible_x, visible_y, height);
    }

    (PANEL_MARGIN, PANEL_MARGIN, 740.0)
}

fn current_panel_width(window: &WebviewWindow) -> f64 {
    window
        .outer_size()
        .ok()
        .map(|size| size.to_logical::<f64>(window.scale_factor().unwrap_or(1.0)).width)
        .filter(|width| *width > 0.0)
        .unwrap_or(PANEL_WIDTH)
}

fn ease_out_expo(progress: f64) -> f64 {
    if progress >= 1.0 {
        1.0
    } else {
        1.0 - 2.0_f64.powf(-10.0 * progress)
    }
}

fn animate_panel(
    window: WebviewWindow,
    from_x: f64,
    to_x: f64,
    y: f64,
    height: f64,
    steps: u64,
) {
    let animation_id = PANEL_ANIMATION_ID.fetch_add(1, Ordering::SeqCst) + 1;
    let panel_width = current_panel_width(&window);

    thread::spawn(move || {
        let _ = window.set_size(LogicalSize::new(panel_width, height));

        for step in 0..=steps {
            if PANEL_ANIMATION_ID.load(Ordering::SeqCst) != animation_id {
                return;
            }

            let progress = step as f64 / steps as f64;
            let eased = ease_out_expo(progress);
            let x = from_x + (to_x - from_x) * eased;
            let _ = window.set_position(LogicalPosition::new(x, y));
            thread::sleep(Duration::from_millis(PANEL_ANIMATION_FRAME_MS));
        }

        let _ = window.set_position(LogicalPosition::new(to_x, y));
    });
}

fn hide_panel(window: &WebviewWindow) {
    let (visible_x, visible_y, height) = panel_metrics(window);
    let panel_width = current_panel_width(window);
    let hidden_x = visible_x - panel_width - PANEL_MARGIN;
    PANEL_VISIBLE.store(false, Ordering::SeqCst);
    animate_panel(
        window.clone(),
        visible_x,
        hidden_x,
        visible_y,
        height,
        PANEL_HIDE_STEPS,
    );
}

fn show_panel(window: &WebviewWindow) {
    let (visible_x, visible_y, height) = panel_metrics(window);
    let panel_width = current_panel_width(window);
    let hidden_x = visible_x - panel_width;
    PANEL_VISIBLE.store(true, Ordering::SeqCst);
    let _ = window.show();
    let _ = window.set_always_on_top(true);
    let _ = window.set_focus();
    animate_panel(
        window.clone(),
        hidden_x,
        visible_x,
        visible_y,
        height,
        PANEL_SHOW_STEPS,
    );
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        tauri_plugin_sql::Migration {
            version: 1,
            description: "create_clip_tables",
            sql: r#"
            CREATE TABLE IF NOT EXISTS clips (
                id TEXT PRIMARY KEY,
                body TEXT NOT NULL,
                title TEXT NOT NULL,
                vault TEXT NOT NULL,
                type TEXT NOT NULL,
                risk TEXT NOT NULL,
                risk_label TEXT NOT NULL,
                before TEXT NOT NULL,
                created_at TEXT NOT NULL,
                last_used_at TEXT,
                use_count INTEGER NOT NULL DEFAULT 0,
                char_count INTEGER NOT NULL DEFAULT 0,
                line_count INTEGER NOT NULL DEFAULT 0,
                token_estimate INTEGER NOT NULL DEFAULT 0
            );

            CREATE VIRTUAL TABLE IF NOT EXISTS clip_search
            USING fts5(id UNINDEXED, body, title, vault, type, risk_label, before);
        "#,
            kind: tauri_plugin_sql::MigrationKind::Up,
        },
        tauri_plugin_sql::Migration {
            version: 2,
            description: "add_editable_note_fields",
            sql: r#"
            ALTER TABLE clips ADD COLUMN description TEXT NOT NULL DEFAULT '';
            ALTER TABLE clips ADD COLUMN when_to_use TEXT NOT NULL DEFAULT '';

            DROP TABLE IF EXISTS clip_search;
            CREATE VIRTUAL TABLE clip_search
            USING fts5(
                id UNINDEXED,
                body,
                title,
                vault,
                type,
                risk_label,
                description,
                when_to_use,
                before
            );
        "#,
            kind: tauri_plugin_sql::MigrationKind::Up,
        },
        tauri_plugin_sql::Migration {
            version: 3,
            description: "mark_development_demo_clips",
            sql: r#"
            ALTER TABLE clips ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0;

            UPDATE clips
            SET is_demo = 1,
                title = CASE
                    WHEN title LIKE '[Demo] %' THEN title
                    ELSE '[Demo] ' || title
                END
            WHERE id LIKE 'demo-%';
        "#,
            kind: tauri_plugin_sql::MigrationKind::Up,
        },
        tauri_plugin_sql::Migration {
            version: 4,
            description: "add_source_application",
            sql: r#"
            ALTER TABLE clips ADD COLUMN source_app_name TEXT NOT NULL DEFAULT '';
            ALTER TABLE clips ADD COLUMN source_app_bundle_id TEXT NOT NULL DEFAULT '';
        "#,
            kind: tauri_plugin_sql::MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                show_panel(&window);
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_shortcut(panel_shortcut())
                .expect("failed to configure panel shortcut")
                .with_handler(|app, shortcut, event| {
                    if shortcut != &panel_shortcut() || event.state() != ShortcutState::Pressed {
                        return;
                    }

                    if let Some(window) = app.get_webview_window("main") {
                        let is_visible = PANEL_VISIBLE.load(Ordering::SeqCst);

                        if is_visible {
                            hide_panel(&window);
                            return;
                        }

                        show_panel(&window);
                    }
                })
                .build(),
        )
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }

            if matches!(event, WindowEvent::Focused(false))
                && PANEL_VISIBLE.load(Ordering::SeqCst)
            {
                if let Some(webview_window) = window.app_handle().get_webview_window("main") {
                    hide_panel(&webview_window);
                }
            }
        })
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:dev-clipboard-spike.db", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![frontmost_application])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
