# UI/UX Improvements

This file summarises intentional UI/UX decisions made for the Presto frontend.

## Navigation and flow

- Clear route separation is used for each major stage: landing, auth, dashboard, editor, and preview.
- Protected routes prevent accidental access to editor/dashboard without login and redirect users to the auth flow.
- In editor mode, the top bar keeps critical actions visible at all times: back, edit metadata, and delete presentation.

## Dashboard usability

- Presentation cards use a consistent 2:1 thumbnail area, making scanability predictable across different screen sizes.
- Cards include title, description, and slide count so users can identify presentations before opening.
- “New presentation” uses a modal to keep users in context instead of forcing a page jump.

## Editor ergonomics

- Slide tools are grouped in one toolbar to reduce hunting for controls.
- Left/right arrow buttons and keyboard arrow keys provide dual navigation inputs.
- Disabled navigation states (first/last slide) are visually distinct to reduce confusion.
- Right-click delete and double-click edit on elements are supported with title hints.

## Feedback and error handling

- Errors are presented via a dismissible dialog instead of blocking browser alerts.
- Error dialog receives focus on open, improving immediate discoverability for keyboard users.
- Validation messages are specific (e.g. invalid percentages, missing required fields, invalid YouTube embed URL).

## Visual customization and consistency

- Text elements support multiple font families with stable defaults for readable presentation content.
- Theme/background modal separates “default for presentation” from “current slide override”, reducing accidental global changes.
- Preview mode removes editing borders and expands content to a large viewport-focused layout for audience-facing display.

## Responsive behavior

- Dashboard cards use auto-fill grid behavior to adapt to narrow and wide screens.
- Toolbars and control groups use wrapping layouts to remain operable on smaller screens.
- Modal content can scroll when tall, preventing inaccessible off-screen controls.
