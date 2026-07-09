# Kanban Board

A production-ready Trello-style Kanban board built with pure HTML, CSS, and vanilla JavaScript. It runs directly in the browser by opening `index.html`, with no framework, build tools, or server required.

## Description

Kanban Board is a polished task board for organizing work across To Do, In Progress, and Done columns. Cards can be created, edited, searched, deleted, reordered, moved between columns, and restored after refresh through localStorage.

## Features

- Three default workflow columns: To Do, In Progress, and Done
- Add cards with an input box, button, or Enter key
- Empty input validation with user feedback
- Drag and drop cards into any column
- Reorder cards and persist card order
- Reorder columns and persist column positions
- Double-click cards to edit with automatic saving
- Delete cards with a confirmation dialog
- Persistent board state using the LocalStorage API
- Creation timestamps and unique IDs for every card
- Search cards instantly
- Clear all cards action
- Per-column card counters
- Dark and light mode toggle
- Success notifications
- Responsive glassmorphism UI
- Custom scrollbars and smooth animations
- CSS-only empty state illustrations
- Keyboard-friendly controls and ARIA labels

## Screenshots

The app includes polished visual states suitable for repository screenshots:

- Light mode board view with CSS-only empty states
- Dark mode board view using the theme toggle
- Mobile board view with stacked responsive columns

## Technologies Used

- HTML5
- CSS3
- JavaScript ES6
- LocalStorage API
- Drag and Drop API

## Folder Structure

```text
kanban-board/
|-- index.html
|-- style.css
|-- script.js
|-- README.md
|-- LICENSE
```

## How to Run

1. Download or clone this repository.
2. Open the `kanban-board` folder.
3. Double-click `index.html`, or open it in any modern browser.

No installation, package manager, build command, or local server is needed.

## LocalStorage Explanation

The application stores board data in the browser's localStorage under the key `vanilla-kanban-board-v1`. Saved data includes:

- Column order
- Card order
- Card content
- Card IDs
- Card creation timestamps

Theme preference is stored separately under `vanilla-kanban-theme`. Because localStorage is browser-specific, data remains available on the same device and browser until it is cleared by the user or browser settings.

## Future Improvements

- Custom column creation and renaming
- Card labels and priority levels
- Due dates and reminders
- Markdown support inside cards
- Import and export board data as JSON
- Optional keyboard shortcuts for faster board navigation

## Author

Created by Subha.

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.
