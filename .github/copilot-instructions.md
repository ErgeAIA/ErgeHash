# HashValidatorPlus - AI Coding Agent Instructions

## Project Overview
HashValidatorPlus is a PyQt5-based file hash validator GUI application (v0.4.0). It computes and verifies file hashes using multiple algorithms (SHA-256, MD5, SHA-1, SHA-512) with support for **batch processing**, multi-file drag-and-drop, pause/resume operations, and intelligent caching. The app is internationalized in Chinese (Simplified).

## Architecture Overview

### Layered Component Structure
```
┌─ main.py (HashValidator: QMainWindow)
│  ├─ file_list.py (DragDropFileListWidget: QListWidget)
│  ├─ hash_worker.py (HashCalculatorThread: QThread)
│  ├─ batch_manager.py (BatchHashManager: coordination layer)
│  ├─ config.py (ConfigManager: persistent state)
│  ├─ exporter.py (DataExporter: CSV/JSON export)
│  └─ [Also has legacy HashCalculator class for backwards compatibility]
└─ app.py (entry point)
```

### Core Components & Their Roles

1. **HashValidator (QMainWindow)** - `main.py`
   - **Main UI orchestrator**: 900x600 window with sidebar + main content + results panel
   - **Left sidebar (200px fixed)**: Algorithm selection (QRadioButton group), nav buttons, quick tips
   - **Main panel**: File list widget (drag-drop), file operations (add/folder buttons), verification section, progress bar
   - **Right panel**: Result display (QTextEdit with HTML formatting), batch operation buttons (start/pause/stop/copy/export)
   - **Key state vars**: `batch_manager`, `calculator_thread`, `is_batch_running`, `batch_start_time`
   - **Signal flow**: File thread → progress/finished/error signals → UI updates

2. **DragDropFileListWidget** - `file_list.py`
   - **Purpose**: Custom QListWidget supporting multi-file drag-drop and recursive folder traversal
   - **Key features**: 
     - `dragEnterEvent()`: Validates MIME URLs, adds blue dashed border
     - `dropEvent()`: Calls `_add_files_recursive()` for both files and directories
     - `_show_context_menu()`: Right-click to remove/clear/copy files
     - Color-coded status display: green ✓ (success), red ✗ (error), orange ⏸ (paused)
   - **Integration**: Emits `get_all_files()` for batch processing

3. **HashCalculatorThread** - `hash_worker.py`
   - **Purpose**: Advanced background hash calculator with pause/resume support
   - **Signals**: `progress`, `batch_progress`, `finished` (hash, elapsed_time), `error`, `status_changed`
   - **Key methods**: 
     - `pause()`: Sets threading.Event to halt computation
     - `resume()`: Clears Event to continue
     - `stop()`: Sets `should_stop` flag for graceful termination
   - **Chunking**: Reads files in 81KB blocks (configurable `chunk_size`)
   - **Timing**: Tracks `start_time` for elapsed time calculation
   - **Error handling**: FileNotFoundError, PermissionError, OSError with user-friendly messages

4. **BatchHashManager** - `batch_manager.py`
   - **Purpose**: Non-GUI queue/state manager for batch processing workflows
   - **Key data**:
     - `file_queue`: List of paths to process
     - `current_index`: Position in queue
     - `results`: List of result dicts (path, algorithm, hash, status, timestamp, elapsed_time)
     - `hash_cache`: Dict[(size, algorithm)] → hash_value for smart caching
   - **Key methods**:
     - `add_files()`, `move_to_next()`, `is_complete()`
     - `cache_hash()`, `get_cached_hash()`: Prevents redundant computation
     - `add_result()`, `get_results()`: Accumulates final results
   - **Caching strategy**: Uses tuple `(file_size, algorithm)` as key; skips re-hashing identical files

5. **ConfigManager** - `config.py`
   - **Purpose**: Persistent user configuration and history tracking
   - **Storage**: `~/.hashvalidatorplus/config.json` (settings) and `history.json` (last 50 hashes)
   - **Key config**:
     - `algorithm`: Last selected algorithm (default "sha256")
     - `window_geometry`: Window size/position
     - `theme`: UI theme preference
     - `auto_copy`: Auto-copy result after calculation
   - **History**: Stores `[{path, algorithm, hash, timestamp}]`

6. **DataExporter** - `exporter.py`
   - **Purpose**: Multi-format result export
   - **Formats**:
     - CSV: UTF-8 with BOM, headers: 文件路径, 算法, 哈希值, 时间
     - JSON: Pretty-printed, preserves full result objects
     - Verification file: Single file format compatible with standard hash checkers (SHA256: hash  filename)

### Batch Processing Data Flow (v0.4.0)

```
1. User drag-drops files/folders → DragDropFileListWidget (visual feedback + dedupe)
2. User clicks "开始批量校验" → start_batch_validation()
   ├─ Clear previous batch_manager state
   ├─ Load all files into file_queue
   ├─ UI state: disable "计算" button, enable pause/stop buttons
   └─ Call _process_next_file()

3. _process_next_file() loop:
   ├─ Check if batch_manager.is_complete() → if yes, call _batch_complete()
   ├─ Check cache: batch_manager.get_cached_hash(file, algo)
   │  ├─ If cached: mark file green, add result, move_to_next(), recursively call self
   │  └─ If not cached: continue to step 4
   ├─ Create HashCalculatorThread(file_path, algorithm)
   ├─ Connect signals: progress → on_progress_update, finished → _on_file_finished, error → _on_file_error
   └─ Start thread

4. Thread running (parallel):
   ├─ Emit progress(0-100) every chunk
   ├─ On completion: emit finished(hash_value, elapsed_time)
   └─ On error: emit error(message)

5. _on_file_finished() callback:
   ├─ Cache the hash: batch_manager.cache_hash()
   ├─ Mark file in UI: file_list_widget.mark_completed() → green ✓
   ├─ Add result: batch_manager.add_result()
   ├─ Update progress bar and result display (HTML format with truncated hash preview)
   ├─ Move to next: batch_manager.move_to_next()
   └─ Recurse: _process_next_file()

6. _batch_complete():
   ├─ Calculate batch statistics (success/error/mismatch counts)
   ├─ Display summary with total time
   ├─ Re-enable "计算" button, disable pause/stop buttons
   └─ Ready for export or new batch
```

## Development Workflows

### Running the Application
```bash
# Development (direct Python execution)
python main.py

# Production (installed package)
pip install .
hashvalidatorplus
```

### Building Standalone EXE
```bash
# Uses build_exe.py and PyInstaller
python build_exe.py
pyinstaller HashValidatorPlus.spec
# Output: dist/HashValidatorPlus.exe
```

### Testing
- **test_calc.py**: Single-file hash calculation test (uses QEventLoop for sync testing)
- **test_batch_features.py**: Batch manager API testing (non-GUI)
- **test_startup.py**: Application startup validation
- **Manual testing**: Drag-drop multiple files/folders, pause mid-batch, verify cache hits

### Dependencies
- **PyQt5** (>=5.15.0): GUI framework
- **hashlib** (builtin): SHA256/MD5/SHA1/SHA512 computation
- **pathlib** (builtin): Cross-platform file operations
- **json, csv** (builtin): Configuration and export

## Key Patterns & Conventions

### Threading Pattern
- **Always use QThread subclass** (never `QThread.run()` directly)
- Store thread reference: `self.calculator_thread = HashCalculatorThread(...)`
- Wait for prior thread: `if self.calculator_thread: self.calculator_thread.wait()`
- Emit signals from thread → connect to main thread slots only (no direct UI updates from worker)
- **Pause/Resume**: Use `threading.Event` in HashCalculatorThread (already implemented in `hash_worker.py`)

### UI Layout Pattern
- **Main layout**: `QHBoxLayout` with sidebar (200px fixed) + main content (stretch)
- **Sidebar**: `QVBoxLayout` with app title, nav buttons, algorithms group, tips
- **Main content**: `QVBoxLayout` stacking file list, verify group, progress, results
- **Colors**: Green (#4CAF50) = success/positive, Red (#f44336) = error/cancel, Blue (#2196F3) = info/copy, Orange (#FF9800) = pause

### File Operations
- Always verify: `if not file_path or not Path(file_path).exists()`
- Read in chunks: Default 81KB blocks in HashCalculatorThread (configurable `chunk_size`)
- Normalize hashes: `.strip().lower()` before comparison
- Batch operations: Use BatchHashManager to track progress without blocking UI

### Signal-Slot Connections
- Thread → Main: `thread.finished.connect(self.on_callback)`
- User action → Handler: `button.clicked.connect(self.handle_click)`
- Naming convention: `on_<source>_<action>` (e.g., `on_file_finished`, `on_progress_update`)
- Always check `self.is_batch_running` state before allowing conflicting operations

### State Management
- **Batch state**: Stored in `self.batch_manager` (queue, results, cache)
- **UI state**: Tracked via button enabled/disabled (prevent double-starts)
- **Config persistence**: ConfigManager auto-saves on `set_config()`/`add_history()`
- **Thread safety**: No direct UI modifications from HashCalculatorThread; only emit signals

## Common Tasks

### Adding a New Hash Algorithm
1. Add to `self.algorithms` tuple in `init_ui()`: `("BLAKE2b", "blake2b")`
2. Regenerate `self.algorithm_ids` mapping (auto-updated)
3. Test with `test_calc.py`: `HashCalculatorThread(test_file, "blake2b")`
4. Verify combo boxes auto-populate from `self.algorithms`

### Batch Processing Enhancements
- **Pause/resume existing**: Already supported via HashCalculatorThread.pause()/resume()
- **Cancel batch**: Click "取消" → `self.calculator_thread.stop()` → next iteration exits loop
- **Smart caching**: Already implemented via `(file_size, algorithm)` keys; verify with identical file re-hashing
- **Progress callbacks**: Override `on_progress_update()` for custom per-file progress display

### Modifying UI Layout
- **Increase window size**: Edit `self.setGeometry(100, 100, WIDTH, HEIGHT)` in `init_ui()`
- **Add sidebar panel**: Insert new `QGroupBox` after algorithms group, before stretch
- **Add result columns**: Modify result HTML in `_on_file_finished()` to display elapsed time, cache status, etc.
- **Theme support**: Use `self.config_manager.get_config("theme")` to apply stylesheets conditionally

### Exporting Results
```python
# CSV export
from exporter import DataExporter
results = self.batch_manager.get_results()
DataExporter.export_to_csv(results, "hashes.csv")

# JSON export
DataExporter.export_to_json(results, "hashes.json")
```

## Error Handling & Validation

### File Operations
- **FileNotFoundError**: User-friendly message in thread error signal
- **PermissionError**: Specific handling (e.g., "权限不足：无法读取文件")
- **OSError**: Generic fallback with exception string
- Always clear `current_file` on persistent errors

### Hash Validation
- Strip whitespace: `expected.strip().lower()`
- Validate format: `all(c in "0123456789abcdefABCDEF " for c in hash_string)`
- Handle spaces: Remove before comparison, preserve in display
- Show comparison result in message box (match/mismatch with visual formatting)

### Thread Safety
- Never call `QWidget.setText()` or similar directly from HashCalculatorThread
- Use signals only: `self.finished.emit(hash_value)`
- Wait for prior thread before starting new one: `if self.calculator_thread: self.calculator_thread.wait()`
- Disable buttons during batch: prevents multiple simultaneous operations

## File Reference
- [main.py](main.py) - Main window, batch orchestration, UI event handlers
- [hash_worker.py](hash_worker.py) - HashCalculatorThread with pause/resume support
- [batch_manager.py](batch_manager.py) - Queue/cache/results management (non-GUI)
- [file_list.py](file_list.py) - DragDropFileListWidget with context menu
- [config.py](config.py) - ConfigManager for persistent settings and history
- [exporter.py](exporter.py) - CSV/JSON export and verification file generation
- [app.py](app.py) - Entry point with dependency validation
- [pyproject.toml](pyproject.toml) - Project metadata, dependencies, entry point
- [build_exe.py](build_exe.py) - PyInstaller configuration generator
- [BATCH_FEATURES.md](BATCH_FEATURES.md) - Batch processing feature documentation
- [README.md](README.md) - User-facing documentation (Chinese)
