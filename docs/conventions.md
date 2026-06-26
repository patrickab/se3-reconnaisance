# Conventions

## Stack

- **Python ≥ 3.12**, managed by **uv** (`uv sync`, `uv run python …`).
  Build backend: **hatchling**; package = `src`.
- Deps kept minimal: `numpy>=2.0`, `matplotlib>=3.8`, `pillow>=10.0`.
- **Frontend:** vanilla static HTML + **three.js@0.160** via CDN importmap.
  No bundler, no npm, no build step. Browser needs internet on first load.

## Lint / format — ruff (the only tool)

- `line-length = 135`, `target-version = py312`, formatter = Black-compatible.
- Lint select: `E F I B C4 TCH SIM ANN ARG RUF`. Ignored: `RUF100`, `B904`.
- `respect-gitignore = true`. isort: force-sort within sections, order
  stdlib → third-party → first-party → local.
- Type hints expected (`ANN`). Scripts use `# noqa: E402` for imports placed
  after the `sys.path`/ROOT bootstrap.

## Code style (observed)

- Scripts resolve repo root via `ROOT = Path(__file__).resolve().parents[3]`,
  then import `from src.backend.io import read_ply`.
- Each script: module docstring with a `uv run …` usage line, a `main()`,
  `argparse` for options.
- numpy-first, vectorized; zero-copy / memmap where the data is large.
- Comments are terse and explain *why* (e.g. why recenter to a local origin).

## Naming

- Python: `snake_case` files & funcs. Object class labels:
  `sniper|tank|atgm|ifv|mortar|howitzer|mlrs|uav_recon|ew`,
  box classes `car|container|wall|house|shelter`.
- Coordinates always **UTM metres**; outputs aim for UTM/MGRS grid refs.
- Frame convention in viewer: **E→X, U→Y (up), N→−Z**.

## Data discipline

- **Never commit data** — `data/*.{ply,json,pcd,las,laz,bag}` gitignored.
  Generated web assets (`src/frontend/public/*`), figures (`docs/figures/`,
  `*.png/*.jpg`), and `uv.lock` are gitignored too.
- Verify the data by parsing it; don't trust marketing claims (see `DATA.md`).

## Git / workflow

- Work on feature branches off `main`.
- **Agent never commits, pushes, or amends unless explicitly told to.**
- Dependabot: weekly pip updates, grouped (streamlit*), reviewer `patrickab`.

## Testing

No test suite yet. Sanity-check via `inspect_ply.py`. Keep tactical outputs
**operator-actionable in < 10 s** (a working demo over slides; honest "here's
where it breaks" over over-claiming).
