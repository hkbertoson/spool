# Vendored anti-slop Oxlint plugin

- **Source repository:** [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop), installed through its `install-anti-slop` skill (`skills/install-anti-slop`).
- **Source commit:** unknown. The skill was installed without a recorded upstream revision; `skills-lock.json` pins only its `computedHash` (`4031728fbe75bdcad6ee3208fd52b5d66e167b056fefee1fa9758e9a6cb9c0c8`).
- **Pristine snapshot:** `.claude/skills/install-anti-slop/assets/anti-slop/` (identical copy in `.agents/skills/install-anti-slop/`). At install time on 2026-09-25 this directory matched it byte for byte.
- **Installed on:** 2026-09-25 with `oxlint` 1.85.0 and `@oxlint/plugins` 1.85.0 (pinned exactly; upgrade them together).

## Installed plugin paths

- `tools/oxlint/anti-slop/index.ts`: generic plugin, registered in `.oxlintrc.json` as `anti-slop`; all 19 generic rules plus native `oxc/no-accumulating-spread` at `error`.
- `tools/oxlint/anti-slop/effect/index.ts`: copied but **not registered**, since the repository has no direct `effect` dependency.
- `tools/oxlint/anti-slop/vendor/eslint-stylistic/`: vendored Stylistic rule with its own `LICENSE` and `UPSTREAM.md`.

## Intentional deviations

None. The files are unmodified from the snapshot above.
