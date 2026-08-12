# Login Button with Aura Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the login button from an invisible icon-only button to a sober, visible button with text and an aura highlight effect.

**Architecture:** Modify the navbar component to replace the ghost button with a default solid button wrapped in DaisyUI's aura component. Add "Iniciar sesión" text alongside the existing icon.

**Tech Stack:** Astro, DaisyUI 5, Tailwind CSS 4

---

### Task 1: Update Login Button Styling

**Files:**
- Modify: `src/layouts/_components/navbar.astro:113-124`

- [ ] **Step 1: Read current navbar component**

Read `src/layouts/_components/navbar.astro` to understand the current login button implementation at lines 113-124.

Current code:
```astro
{
    user.id === 0 ? (
        <a
            href={resolveUrl("/login")}
            aria-label="Iniciar sesión"
            class="btn btn-ghost btn-circle"
            title="Iniciar sesión"
        >
            <Icon
                name="boxicons:arrow-out-right-stroke-circle-half-filled"
                size={20}
            />
        </a>
    ) : (
        // ... user menu
    )
}
```

- [ ] **Step 2: Update button classes for solid style**

Replace `btn btn-ghost btn-circle` with `btn btn-sm` to use default solid button style (not ghost, not outlined). Remove `btn-circle` since we're adding text.

```astro
{
    user.id === 0 ? (
        <a
            href={resolveUrl("/login")}
            aria-label="Iniciar sesión"
            class="btn btn-sm"
            title="Iniciar sesión"
        >
            <Icon
                name="boxicons:arrow-out-right-stroke-circle-half-filled"
                size={20}
            />
            Iniciar sesión
        </a>
    ) : (
        // ... user menu
    )
}
```

- [ ] **Step 3: Add aura wrapper for highlight effect**

Wrap the button with DaisyUI's `aura` component to make it stand out. Use default aura style (no modifier needed).

```astro
{
    user.id === 0 ? (
        <div class="aura">
            <a
                href={resolveUrl("/login")}
                aria-label="Iniciar sesión"
                class="btn btn-sm"
                title="Iniciar sesión"
            >
                <Icon
                    name="boxicons:arrow-out-right-stroke-circle-half-filled"
                    size={20}
                />
                Iniciar sesión
            </a>
        </div>
    ) : (
        // ... user menu
    )
}
```

- [ ] **Step 4: Verify implementation**

Run dev server and check the login button:
```bash
npm run dev
```
Navigate to any page while logged out. Verify:
- Button has solid background (not ghost/invisible)
- Button shows "Iniciar sesión" text with icon
- Aura effect is visible around button
- Button is sober and professional looking

- [ ] **Step 5: Commit changes**

```bash
git add src/layouts/_components/navbar.astro
git commit -m "feat: update login button with text and aura effect

- Change from ghost circle button to solid button with text
- Add 'Iniciar sesión' label alongside icon
- Wrap with DaisyUI aura component for highlight effect
- Maintain sober, professional appearance"
```

---

## Self-Review Checklist

1. **Spec coverage:** ✓ Login button changes covered (styling, text, aura)
2. **Placeholder scan:** ✓ No TBD/TODO/placeholders found
3. **Type consistency:** ✓ Using existing DaisyUI class names consistently
