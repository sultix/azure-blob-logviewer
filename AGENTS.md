# AGENTS.md

## Purpose

This file defines the engineering rules for coding agents working in this repository.

The project is a **Wails + Go + TypeScript + Angular** desktop application with:

- modern Angular architecture
- standalone APIs
- signal-first local state
- small focused components
- clean code
- secure Wails boundaries
- Tailwind CSS
- PrimeNG for selected higher-level UI building blocks
- Heroicons as the preferred icon set

When making changes, optimize for:

- clarity over cleverness
- security over convenience
- composition over inheritance
- small reusable UI units over large smart components
- explicit types over implicit behavior
- Angular-native patterns over custom abstractions

---

## Tech stack

- **Wails** for desktop shell and Go-based native bridge
- **Go** for backend/native application logic
- **TypeScript** in the frontend
- **Angular**
- **Standalone Angular APIs** only for new Angular code
- **Angular signals** for local reactive state
- **Signal inputs** via `input()`
- **Component events** via `output()`
- **Tailwind CSS** for styling
- **PrimeNG** for selected complex UI controls
- **Heroicons** as the preferred icon source

Prefer current Angular patterns such as:

- standalone components
- `inject()` where it improves clarity
- signals
- control flow syntax: `@if`, `@for`, `@switch`
- `input()` and `output()`

Avoid legacy Angular patterns unless there is a clear project-specific reason.

---

## Core engineering principles

### 1. Keep components small

Each component should do one thing well.

Guidelines:

- Prefer presentational components under ~150 lines when practical
- Extract repeated UI into shared components once a pattern is clearly recurring
- Move business logic out of templates
- Move non-trivial orchestration into services or feature state helpers
- Avoid god components with many responsibilities

A component should usually own one of these responsibilities:

- render data
- collect input
- orchestrate one small screen section
- wrap one reusable interaction pattern

### 2. Clean code first

Code must be easy to scan and easy to change.

Guidelines:

- Use descriptive names
- Keep functions short
- Prefer early returns
- Avoid deep nesting when possible
- Remove dead code and commented-out code
- Do not introduce abstractions without an actual caller
- Keep public APIs minimal

### 3. Prefer composition

- Build features from small components and focused services
- Prefer composable helpers over inheritance
- Avoid deep inheritance chains
- Avoid giant shared helpers files

### 4. Type safety is required

- Do not use `any` unless unavoidable and documented
- Prefer `unknown` over `any`
- Model domain objects with clear interfaces or types
- Narrow types at boundaries
- Keep frontend/backend payloads and results strongly typed

---

## Angular rules

### Architecture

- Use **standalone components/directives/pipes only** for new code
- Do not introduce NgModules in new Angular code
- Use `bootstrapApplication()` style structure
- Prefer feature-based folders over type-only folders when the feature is substantial
- Keep shared UI in `shared/` and domain logic inside feature folders

Example structure:

```text
src/
  app/
    core/
      services/
      guards/
      layout/
      tokens/
    shared/
      ui/
      directives/
      pipes/
      utils/
    features/
      dashboard/
        components/
        pages/
        services/
        models/
      settings/
        components/
        pages/
        services/
        models/
```

### Components

- Prefer `ChangeDetectionStrategy.OnPush`
- Keep templates readable and shallow
- Avoid heavy expressions in templates
- Never call expensive functions directly from templates
- Prefer `computed()` for derived UI state
- If component logic grows, extract helpers or services

### Dependency injection

- Prefer `inject()` when it reduces boilerplate or improves readability
- Constructor injection is still acceptable when it is clearer
- Keep services focused and cohesive
- Prefer `providedIn: 'root'` for app-wide singletons when appropriate
- Avoid turning services into unstructured global state stores

### Inputs and outputs

- Prefer signal inputs with `input()`
- Use `input.required<T>()` when a component cannot function without the input
- Keep input names clear and stable
- Avoid too many inputs on one component; split the component if needed
- Prefer strongly typed outputs via `output()`
- Use clear event names that describe what happened

Example:

```ts
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-user-card',
  standalone: true,
  templateUrl: './user-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserCardComponent {
  readonly user = input.required<User>();
  readonly compact = input(false);

  readonly selected = output<User>();

  readonly fullName = computed(() => `${this.user().firstName} ${this.user().lastName}`);

  onSelect(): void {
    this.selected.emit(this.user());
  }
}
```

### Template expression rules

- Do not call arbitrary component methods or getters from templates.
- Direct reads of Angular `signal()`, `input()`, and `computed()` values in templates are allowed in this repository, for example `status()`, `rows()`, `footer()`, `savedConnectionsCount()`, or `pageVm()`.
- This allowance applies only to signal-style reactive reads. It does not make normal methods or getters acceptable in bindings.
- Template expressions must stay cheap, side-effect free, and allocation free.
- If a value requires mapping, sorting, filtering, formatting, object creation, array creation, service access, DOM access, or combining multiple reactive sources, compute it in the component or service first.
- Avoid proxy getters such as `get rowsValue()` or `get statusValue()` that only wrap a signal read for template usage. Prefer binding the signal or `computed()` directly.
- If the same signal or `computed()` is read several times in one block, prefer aliasing or a dedicated view-model `computed()`, for example `@if (pageVm(); as vm)` or `@if (statusBadge(); as badge)`.
- Event handlers are still allowed to call methods, for example `(click)="save()"`.

### Signals

- Prefer signals for local component state
- Prefer `computed()` for derived state
- Use `effect()` sparingly and only for real side effects
- Do not use `effect()` for simple derivations that belong in `computed()`
- Keep signal graphs understandable
- Avoid unnecessary RxJS/signals ping-pong

### RxJS

RxJS is allowed where it is the right tool.

Use RxJS for:

- async streams
- websocket/event streams
- cancellation and concurrency flows
- library APIs that already return observables

Use signals for:

- local UI state
- synchronous derived state
- simple view model composition

When bridging:

- keep conversions explicit
- avoid unnecessary back-and-forth conversions

### Templates

- Use Angular’s modern control flow syntax: `@if`, `@for`, `@switch`
- Use `track` in `@for` when rendering collections with stable identity
- Keep templates declarative and presentation-focused
- Extract repeated template sections into components

### Forms

- Prefer typed reactive forms
- Keep validation messages centralized and reusable
- Split large forms into logical sections
- Do not introduce experimental Angular APIs in production code unless the repository has explicitly opted in and documented it

---

## PrimeNG rules

Use **PrimeNG** selectively for higher-level UI controls that would be wasteful to rebuild from scratch.

Good candidates:

- dialogs
- overlays
- tables
- date pickers
- menus
- selects
- tree or data-heavy controls

Guidelines:

- Prefer Angular-native composition around PrimeNG components
- Wrap repeated PrimeNG usage patterns in small shared components
- Do not scatter one-off PrimeNG customization everywhere
- Keep styling consistent with Tailwind and the project design system
- Prefer provider-based configuration at app setup
- Keep overlays, dialogs, and tables accessible and predictable
- Avoid mixing several UI libraries for the same problem in the same feature

PrimeNG should support the design system, not define it.

---

## Heroicons rules

Use **Heroicons** as the preferred icon source.

Guidelines:

- Do not assume an official Angular Heroicons package exists
- Use one approved Angular integration approach consistently across the repo
- Prefer a shared wrapper or icon adapter instead of ad-hoc icon usage
- Prefer outline icons for neutral UI
- Use solid icons only for stronger emphasis when needed
- Keep icon sizing consistent with Tailwind utility classes
- Decorative icons must be hidden from assistive tech
- Meaningful icons must have an accessible label or nearby text
- Do not mix multiple icon systems without a clear reason
- PrimeIcons may be used as a fallback when a suitable Heroicon does not exist or when a PrimeNG component conventionally relies on PrimeIcons
- Prefer Heroicons for app-level custom UI; use PrimeIcons mainly as a pragmatic fallback for PrimeNG-aligned controls and edge cases

Recommended approach:

- define one repository-standard Angular icon integration
- keep icon imports centralized where practical
- avoid introducing a second icon abstraction unless it solves a real problem
- where PrimeNG is already the dominant control in a UI area, PrimeIcons are acceptable if they reduce unnecessary custom adaptation

---

## Tailwind CSS rules

- Use Tailwind for nearly all component styling
- Prefer utility classes in templates over large custom SCSS files
- Extract repeated utility combinations into small wrapper components when repetition becomes clear
- Keep spacing, sizing, and typography consistent
- Prefer semantic layout wrappers over random utility piles
- Avoid very long unreadable class strings

### Styling guidelines

- Mobile-first by default
- Use a consistent spacing scale
- Use design tokens or Tailwind theme extensions when defined by the project
- Keep colors, radius, shadows, and typography aligned with the design system
- Prefer accessible contrast and visible focus states

### Do not

- add arbitrary values everywhere without reason
- mix several styling strategies in one feature without need
- reintroduce heavy custom CSS when Tailwind utilities are sufficient

---

## Wails and Go rules

### Security is mandatory

Wails code must follow a least-privilege model.

Always:

- expose only the minimum backend surface needed to the frontend
- keep frontend and Go responsibilities clearly separated
- validate all inputs coming from the frontend
- validate outputs at the boundary where appropriate
- treat all frontend-provided values as untrusted
- restrict file-system, process, and OS access to focused backend functions
- prefer small explicit exported methods over broad utility backends

Do not:

- expose raw file-system, shell, or OS access without validation
- create overly broad backend APIs that act like a general-purpose bridge
- pass unvalidated file paths, commands, or user input into privileged operations
- mix backend/native concerns into Angular UI code
- hide side effects behind generic helper methods

### Process boundaries

- Go backend: app lifecycle, native integrations, file system access, OS integration, privileged operations
- Wails bridge: typed boundary between frontend and backend
- Angular frontend: UI only

### Backend API conventions

- Keep frontend/backend contracts typed and centralized
- Prefer explicit request/response APIs with clear payload types
- Validate payloads at the boundary
- Keep method names explicit and purpose-specific, for example:
  - `GetSettings`
  - `UpdateSettings`
  - `OpenFileDialog`
  - `GetVersion`

Example shared typing:

```ts
export interface AppApi {
  getVersion: () => Promise<string>;
  openFile: () => Promise<{ canceled: boolean; path?: string }>;
}
```

### Go code guidelines

- Keep Go packages small and focused
- Prefer clear package boundaries over large utility packages
- Return explicit errors and handle them properly
- Avoid panic for expected runtime failures
- Keep exported APIs minimal
- Inject dependencies where practical instead of relying on hidden globals
- Prefer small structs with focused responsibilities
- Use context where appropriate for cancellation or timeouts
- Keep OS and file-system operations behind clearly named functions

### Error handling

- Errors returned from Go backend methods must be meaningful and safe
- Do not leak sensitive system details in user-facing error messages
- Log enough detail for debugging, but keep frontend messages concise
- Convert backend errors into predictable frontend states: loading, success, empty, error

---

## File and folder conventions

### General

- Keep filenames lowercase kebab-case in the frontend
- Follow idiomatic Go naming in backend Go packages and files
- One primary class/component per frontend file
- Co-locate template/style/test files with the component
- Keep feature internals inside the feature folder unless clearly shared

### Suggested Angular naming

- `feature-name.page.component.ts` for route-level containers
- `thing-card.component.ts` for presentational components
- `feature-name.service.ts` for focused business services
- `feature-name.store.ts` only when there is a real local store abstraction
- `feature-name.types.ts` or `feature-name.models.ts` for domain models

### Suggested Go structure

```text
backend/
  app/
  services/
  system/
  files/
  models/
```

Keep the actual structure aligned with the repository conventions if they already exist.

### Shared code

Before moving code to `shared/`, verify that it is actually reused or clearly cross-cutting.

---

## State management guidance

- Start simple
- Use local component signals first
- Extract feature state only when several components truly share it
- Do not introduce a heavy global state solution unless the repository already uses one and the feature clearly benefits from it
- Keep async state explicit: loading, success, empty, error

A good pattern is a thin page/container component that:

- loads feature data
- maps data into a small view model
- passes that data to presentational child components

---

## Routing

- Keep route configuration close to the feature when practical
- Lazy load feature areas where it improves startup or separation
- Keep route guards small and specific
- Do not put heavy data mapping logic inside route config files

---

## Testing with Vitest

- Use **Vitest** as the default test runner for new Angular unit and component tests
- For existing projects, do not force migration unless the repository is already aligned with it
- Write new tests with `describe`, `it`, `expect`, `vi`
- Prefer fast isolated tests for components, services, pipes, guards, and pure helpers
- Keep tests close to the source file using `*.spec.ts`
- Prefer Angular `TestBed` only when Angular integration is actually needed
- Prefer direct class tests for pure services/helpers that do not need Angular runtime
- Mock time, globals, and module boundaries with `vi`
- Prefer deterministic tests

### Vitest conventions

- Use `beforeEach` for clear setup
- Prefer small focused assertions over long test flows
- Use `vi.mock()` at module boundaries when mocking dependencies
- Use `vi.fn()` for callback spies
- Reset or restore mocks between tests when needed
- Prefer `async/await` over nested callbacks

### Angular component tests

- Test rendered output, inputs, outputs, and visible states
- Prefer testing through the DOM over private implementation details
- Cover key UI states: loading, empty, success, error
- For signal inputs, set inputs explicitly and assert the rendered result
- Keep host test components minimal
- Mock child components only when they are irrelevant to the behavior under test

Example:

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { UserCardComponent } from './user-card.component';

describe('UserCardComponent', () => {
  it('renders the full name', async () => {
    await TestBed.configureTestingModule({
      imports: [UserCardComponent],
    }).compileComponents();

    const fixture: ComponentFixture<UserCardComponent> = TestBed.createComponent(UserCardComponent);
    fixture.componentRef.setInput('user', {
      firstName: 'Ada',
      lastName: 'Lovelace',
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Ada Lovelace');
  });
});
```

### Go testing

- Use Go’s standard testing tools for backend code
- Keep tests close to the package under test
- Prefer table-driven tests for pure logic where appropriate
- Mock external system interactions behind interfaces when useful
- Keep backend tests deterministic and focused
- Test input validation, error paths, and boundary cases

---

## ESLint for Wails and Angular

### General linting goals

- Use ESLint as the single linting standard for the frontend repository
- Keep one shared base configuration and extend it for Angular app code and tests
- Prefer strict but practical rules that improve readability, safety, and refactoring confidence
- Treat lint warnings as technical debt
- Avoid disabling rules globally; prefer local exceptions with a short reason

### Angular ESLint rules

- Use Angular ESLint for Angular TypeScript and template linting
- Enforce standalone-first Angular patterns
- Prefer `inject()` where appropriate
- Prefer `input()`, `output()`, and `computed()` where appropriate
- Keep components, directives, and pipes focused and small
- Avoid complex logic in templates
- Do not enable blanket template call-expression rules that would flag signal reads; configure linting to distinguish signal/computed reads from arbitrary method calls
- Prefer `readonly` for immutable members and injected dependencies where applicable

### Angular template linting

- Lint HTML templates with Angular ESLint template rules
- Prefer accessibility-friendly markup
- Avoid expensive template calls, hidden side effects, and allocation-heavy expressions in bindings
- Direct signal and `computed()` reads in templates are acceptable; expensive or imperative methods are not
- Keep templates declarative and readable

### Frontend boundary rules

- Do not access backend/native functionality directly except through the Wails-generated frontend bridge
- Keep Wails calls out of low-level presentational components when possible
- Centralize backend contract typing and usage patterns
- Prefer named exports and explicit boundaries in frontend integration code

### TypeScript and code quality rules

- Enable rules that encourage:
  - no unused variables
  - no floating promises
  - consistent type imports
  - no shadowed variables
  - strict equality
  - no unnecessary assertions
  - no fallthrough in switches
- Prefer `unknown` over `any`
- Prefer small pure helper functions
- Use async/await over nested promise chains

### Go linting

- Use standard Go formatting and linting tools consistently across the backend
- Keep backend lint rules strict around error handling, unused code, and complexity
- Do not ignore returned errors without a documented reason
- Prefer idiomatic Go code over patterns copied from TypeScript or Java

### Test linting

- Lint test files with Vitest-aware overrides in frontend code
- Allow test-only relaxations only in test files
- Keep production rules strict
- Test names should be descriptive and behavior-focused

---

## Accessibility

- Use semantic HTML first
- Ensure keyboard access for interactive controls
- Preserve visible focus states
- Add ARIA only when native semantics are insufficient
- Buttons should be buttons, links should be links

---

## Performance guidance

- Prefer OnPush and signals-friendly patterns
- Avoid unnecessary rerenders caused by recreating objects in templates
- Use `track` in list rendering
- Lazy load heavy features when appropriate
- Be careful with desktop memory and CPU usage
- Keep Go backend calls focused and avoid chatty frontend/backend roundtrips

---

## What agents should do before coding

1. Determine whether the change belongs to **Go backend**, **Wails bridge**, or **Angular frontend**
2. Find the smallest clean place to implement it
3. Reuse existing project patterns instead of inventing new ones
4. Keep the change scoped
5. Update typings and contracts first when changing boundaries

---

## What agents must avoid

- large rewrites without need
- introducing NgModules in new Angular code
- using `@Input()` in new components when `input()` is appropriate
- massive components with UI, state, mapping, and business logic all together
- unstructured shared utility dumping grounds
- weakly typed frontend/backend bridges
- unsafe native access shortcuts
- inconsistent UI library usage inside one feature

---

## Preferred implementation patterns

### Good

- small presentational components
- standalone pages and components
- `input()` and `computed()`
- `output()`
- `inject()` where it improves clarity
- feature folders
- typed Wails bridge usage
- Tailwind utilities with consistent spacing
- explicit loading, error, and empty states
- small focused Go services

### Bad

- giant smart components
- constructor-heavy boilerplate when a simpler pattern is clearer
- broad mutable shared state
- template logic that reads like code-behind
- direct UI coupling to native or OS logic
- CSS that fights Tailwind
- generic backend methods that expose too much privilege

---

## Definition of done

A task is complete when:

- the code is typed and readable
- Angular code follows modern standalone and signal-first conventions
- components remain small and focused
- styling follows Tailwind conventions
- PrimeNG usage is consistent where applicable
- Wails/frontend/backend boundaries stay secure
- tests were updated where appropriate
- no obvious dead code or incidental complexity was introduced

---

## Decision rule

When there are several valid approaches, choose the one that is:

1. safest
2. simplest
3. most consistent with existing project patterns
4. easiest for the next developer to understand
