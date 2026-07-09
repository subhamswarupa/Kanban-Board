"use strict";

class KanbanBoard {
  constructor() {
    this.storageKey = "vanilla-kanban-board-v1";
    this.themeKey = "vanilla-kanban-theme";
    this.boardElement = document.getElementById("board");
    this.cardForm = document.getElementById("cardForm");
    this.cardInput = document.getElementById("cardInput");
    this.searchInput = document.getElementById("searchInput");
    this.clearAllButton = document.getElementById("clearAll");
    this.themeToggle = document.getElementById("themeToggle");
    this.toastRegion = document.getElementById("toastRegion");
    this.confirmModal = document.getElementById("confirmModal");
    this.cancelDeleteButton = document.getElementById("cancelDelete");
    this.confirmDeleteButton = document.getElementById("confirmDelete");
    this.pendingDeleteId = null;
    this.draggedCardId = null;
    this.draggedColumnId = null;
    this.dropIndicator = this.createDropIndicator();
    this.columns = [];

    this.defaultColumns = [
      { id: "todo", title: "To Do", color: "#2477f3", cards: [] },
      { id: "progress", title: "In Progress", color: "#f59e0b", cards: [] },
      { id: "done", title: "Done", color: "#14b86f", cards: [] }
    ];

    this.init();
  }

  init() {
    this.loadBoard();
    this.applySavedTheme();
    this.renderBoard();
    this.bindEvents();
    this.updateCounters();
    this.searchCards();
  }

  bindEvents() {
    this.cardForm.addEventListener("submit", (event) => {
      event.preventDefault();
      this.createCard(this.cardInput.value);
    });

    this.searchInput.addEventListener("input", () => this.searchCards());
    this.themeToggle.addEventListener("click", () => this.toggleTheme());
    this.clearAllButton.addEventListener("click", () => this.clearAllCards());
    this.cancelDeleteButton.addEventListener("click", () => this.closeConfirmDialog());
    this.confirmDeleteButton.addEventListener("click", () => this.confirmDeleteCard());

    this.confirmModal.addEventListener("click", (event) => {
      if (event.target === this.confirmModal) {
        this.closeConfirmDialog();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        this.closeConfirmDialog();
        this.finishEditingCard();
      }
    });
  }

  saveBoard() {
    // Store the complete board shape so refreshes preserve column order and card order.
    localStorage.setItem(this.storageKey, JSON.stringify({ columns: this.columns }));
  }

  loadBoard() {
    const storedBoard = localStorage.getItem(this.storageKey);

    if (!storedBoard) {
      this.columns = this.createStarterBoard();
      this.saveBoard();
      return;
    }

    try {
      const parsedBoard = JSON.parse(storedBoard);
      this.columns = this.normalizeColumns(parsedBoard.columns);
    } catch {
      this.columns = this.createStarterBoard();
      this.saveBoard();
    }
  }

  createStarterBoard() {
    return this.defaultColumns.map((column) => ({
      ...column,
      cards: []
    }));
  }

  normalizeColumns(columns) {
    // Merge saved data with defaults so future column metadata changes do not break old boards.
    const incomingColumns = Array.isArray(columns) ? columns : [];
    const merged = this.defaultColumns.map((defaultColumn) => {
      const savedColumn = incomingColumns.find((column) => column.id === defaultColumn.id);
      return {
        ...defaultColumn,
        ...savedColumn,
        cards: Array.isArray(savedColumn?.cards) ? savedColumn.cards : []
      };
    });

    return merged.sort((first, second) => {
      const firstIndex = incomingColumns.findIndex((column) => column.id === first.id);
      const secondIndex = incomingColumns.findIndex((column) => column.id === second.id);
      return (firstIndex === -1 ? 99 : firstIndex) - (secondIndex === -1 ? 99 : secondIndex);
    });
  }

  createCard(title) {
    const cleanTitle = title.trim();

    if (!cleanTitle) {
      this.showToast("Enter a card title before adding.");
      this.cardInput.focus();
      return;
    }

    const card = {
      id: this.generateId(),
      title: cleanTitle,
      createdAt: new Date().toISOString()
    };

    this.columns[0].cards.unshift(card);
    this.cardInput.value = "";
    this.saveBoard();
    this.renderBoard();
    this.updateCounters();
    this.searchCards();
    this.showToast("Card added.");
  }

  deleteCard(cardId) {
    this.pendingDeleteId = cardId;
    this.confirmModal.hidden = false;
    this.confirmDeleteButton.focus();
  }

  confirmDeleteCard() {
    if (!this.pendingDeleteId) {
      return;
    }

    const removed = this.removeCardById(this.pendingDeleteId);
    this.pendingDeleteId = null;
    this.closeConfirmDialog();

    if (removed) {
      this.saveBoard();
      this.renderBoard();
      this.updateCounters();
      this.searchCards();
      this.showToast("Card deleted.");
    }
  }

  closeConfirmDialog() {
    this.confirmModal.hidden = true;
    this.pendingDeleteId = null;
  }

  editCard(cardId, value) {
    const card = this.findCard(cardId);
    const cleanValue = value.trim();

    if (!card || !cleanValue) {
      this.renderBoard();
      this.showToast("Card title cannot be empty.");
      return;
    }

    if (card.title !== cleanValue) {
      card.title = cleanValue;
      this.saveBoard();
      this.showToast("Card updated.");
    }

    this.renderBoard();
    this.searchCards();
  }

  finishEditingCard() {
    const editingTitle = this.boardElement.querySelector('.card-title[contenteditable="true"]');
    if (editingTitle) {
      editingTitle.blur();
    }
  }

  dragStart(event) {
    const card = event.target.closest(".kanban-card");
    if (!card) {
      return;
    }

    this.draggedCardId = card.dataset.cardId;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", this.draggedCardId);
    window.requestAnimationFrame(() => card.classList.add("dragging"));
  }

  dragEnd(event) {
    const card = event.target.closest(".kanban-card");
    if (card) {
      card.classList.remove("dragging");
    }

    this.draggedCardId = null;
    this.dropIndicator.remove();
    this.clearColumnHover();
  }

  allowDrop(event) {
    event.preventDefault();
    const column = event.target.closest(".column");
    const list = event.target.closest(".card-list");

    if (!column || !list || !this.draggedCardId) {
      return;
    }

    this.clearColumnHover();
    column.classList.add("column-over");
    // Insert a real indicator into the list, then use its position as the saved card index.
    const afterElement = this.getCardAfterPointer(list, event.clientY);

    if (!afterElement) {
      list.appendChild(this.dropIndicator);
    } else {
      list.insertBefore(this.dropIndicator, afterElement);
    }
  }

  dropCard(event) {
    event.preventDefault();
    const column = event.target.closest(".column");

    if (!column || !this.draggedCardId) {
      return;
    }

    const destinationColumn = this.columns.find((item) => item.id === column.dataset.columnId);
    const movingCard = this.removeCardById(this.draggedCardId);

    if (!destinationColumn || !movingCard) {
      return;
    }

    const visibleCards = [...column.querySelectorAll(".kanban-card:not(.dragging)")];
    const insertIndex = this.dropIndicator.parentElement
      ? [...this.dropIndicator.parentElement.children].indexOf(this.dropIndicator)
      : visibleCards.length;

    destinationColumn.cards.splice(Math.max(0, insertIndex), 0, movingCard);
    this.saveBoard();
    this.renderBoard();
    this.updateCounters();
    this.searchCards();
    this.showToast("Card moved.");
  }

  startColumnDrag(event) {
    const column = event.target.closest(".column");
    const isCard = event.target.closest(".kanban-card");
    const isButton = event.target.closest("button");

    // Card drags bubble through the column, so only start column dragging from column chrome.
    if (isCard || isButton) {
      return;
    }

    if (!column) {
      event.preventDefault();
      return;
    }

    this.draggedColumnId = column.dataset.columnId;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/column", this.draggedColumnId);
    window.requestAnimationFrame(() => column.classList.add("dragging-column"));
  }

  endColumnDrag(event) {
    const column = event.target.closest(".column");
    if (column) {
      column.classList.remove("dragging-column");
    }
    this.draggedColumnId = null;
  }

  allowColumnDrop(event) {
    if (!this.draggedColumnId || event.target.closest(".kanban-card")) {
      return;
    }

    event.preventDefault();
  }

  dropColumn(event) {
    if (!this.draggedColumnId || event.target.closest(".kanban-card")) {
      return;
    }

    event.preventDefault();
    const targetColumn = event.target.closest(".column");

    if (!targetColumn || targetColumn.dataset.columnId === this.draggedColumnId) {
      return;
    }

    const fromIndex = this.columns.findIndex((column) => column.id === this.draggedColumnId);
    const toIndex = this.columns.findIndex((column) => column.id === targetColumn.dataset.columnId);

    if (fromIndex === -1 || toIndex === -1) {
      return;
    }

    const [movingColumn] = this.columns.splice(fromIndex, 1);
    this.columns.splice(toIndex, 0, movingColumn);
    this.saveBoard();
    this.renderBoard();
    this.updateCounters();
    this.searchCards();
    this.showToast("Column order saved.");
  }

  updateCounters() {
    this.columns.forEach((column) => {
      const counter = this.boardElement.querySelector(`[data-counter-for="${column.id}"]`);
      if (counter) {
        counter.textContent = String(column.cards.length);
        counter.setAttribute("aria-label", `${column.cards.length} cards in ${column.title}`);
      }
    });
  }

  toggleTheme() {
    const isDark = document.documentElement.dataset.theme === "dark";
    const nextTheme = isDark ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem(this.themeKey, nextTheme);
    this.themeToggle.setAttribute("aria-label", `Switch to ${isDark ? "dark" : "light"} mode`);
    this.showToast(`${nextTheme === "dark" ? "Dark" : "Light"} mode enabled.`);
  }

  searchCards() {
    // Search hides unmatched cards without mutating saved board data.
    const query = this.searchInput.value.trim().toLowerCase();
    const cards = this.boardElement.querySelectorAll(".kanban-card");

    cards.forEach((card) => {
      const title = card.querySelector(".card-title")?.textContent.toLowerCase() || "";
      card.classList.toggle("hidden-by-search", Boolean(query) && !title.includes(query));
    });

    this.updateEmptyStates();
  }

  clearAllCards() {
    const totalCards = this.columns.reduce((sum, column) => sum + column.cards.length, 0);

    if (!totalCards) {
      this.showToast("Board is already clear.");
      return;
    }

    const confirmed = window.confirm("Clear all cards from every column?");
    if (!confirmed) {
      return;
    }

    this.columns = this.columns.map((column) => ({ ...column, cards: [] }));
    this.saveBoard();
    this.renderBoard();
    this.updateCounters();
    this.searchCards();
    this.showToast("All cards cleared.");
  }

  renderBoard() {
    this.boardElement.innerHTML = "";

    this.columns.forEach((column) => {
      const columnElement = this.createColumnElement(column);
      this.boardElement.appendChild(columnElement);
    });

    this.updateEmptyStates();
  }

  createColumnElement(column) {
    const section = document.createElement("article");
    section.className = "column";
    section.dataset.columnId = column.id;
    section.style.setProperty("--column-color", column.color);
    section.draggable = true;
    section.setAttribute("aria-labelledby", `${column.id}-title`);

    section.addEventListener("dragstart", (event) => this.startColumnDrag(event));
    section.addEventListener("dragend", (event) => this.endColumnDrag(event));
    section.addEventListener("dragover", (event) => this.allowColumnDrop(event));
    section.addEventListener("drop", (event) => this.dropColumn(event));

    const header = document.createElement("header");
    header.className = "column-header";
    header.setAttribute("aria-label", `${column.title} column. Drag to reorder columns.`);

    const titleWrap = document.createElement("div");
    titleWrap.className = "column-title";

    const dot = document.createElement("span");
    dot.className = "column-dot";
    dot.setAttribute("aria-hidden", "true");

    const title = document.createElement("h2");
    title.id = `${column.id}-title`;
    title.textContent = column.title;

    const counter = document.createElement("span");
    counter.className = "counter";
    counter.dataset.counterFor = column.id;
    counter.textContent = String(column.cards.length);

    titleWrap.append(dot, title);
    header.append(titleWrap, counter);

    const list = document.createElement("div");
    list.className = "card-list";
    list.dataset.columnId = column.id;
    list.setAttribute("role", "list");
    list.setAttribute("aria-label", `${column.title} cards`);
    list.addEventListener("dragover", (event) => this.allowDrop(event));
    list.addEventListener("drop", (event) => this.dropCard(event));
    list.addEventListener("dragleave", (event) => {
      if (!section.contains(event.relatedTarget)) {
        section.classList.remove("column-over");
      }
    });

    column.cards.forEach((card) => list.appendChild(this.createCardElement(card)));
    section.append(header, list);
    return section;
  }

  createCardElement(card) {
    const article = document.createElement("article");
    article.className = "kanban-card";
    article.dataset.cardId = card.id;
    article.draggable = true;
    article.setAttribute("role", "listitem");
    article.setAttribute("tabindex", "0");
    article.setAttribute("aria-label", `${card.title}. Created ${this.formatDate(card.createdAt)}.`);
    article.addEventListener("dragstart", (event) => this.dragStart(event));
    article.addEventListener("dragend", (event) => this.dragEnd(event));
    article.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.target.isContentEditable) {
        this.beginEditingCard(article, card.id);
      }
      if ((event.key === "Backspace" || event.key === "Delete") && !event.target.isContentEditable) {
        this.deleteCard(card.id);
      }
    });

    const title = document.createElement("p");
    title.className = "card-title";
    title.textContent = card.title;
    title.addEventListener("dblclick", () => this.beginEditingCard(article, card.id));
    title.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        title.blur();
      }
    });
    title.addEventListener("blur", () => this.editCard(card.id, title.textContent));

    const meta = document.createElement("div");
    meta.className = "card-meta";

    const timestamp = document.createElement("time");
    timestamp.dateTime = card.createdAt;
    timestamp.textContent = this.formatDate(card.createdAt);

    const id = document.createElement("span");
    id.className = "card-id";
    id.textContent = card.id;
    id.title = `Card ID: ${card.id}`;

    const deleteButton = document.createElement("button");
    deleteButton.className = "card-action";
    deleteButton.type = "button";
    deleteButton.setAttribute("aria-label", `Delete ${card.title}`);
    deleteButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 11v6M14 11v6M9 7l1-2h4l1 2M7 7l1 13h8l1-13"/></svg>';
    deleteButton.addEventListener("click", () => this.deleteCard(card.id));

    meta.append(timestamp, id);
    article.append(title, meta, deleteButton);
    return article;
  }

  beginEditingCard(cardElement, cardId) {
    const title = cardElement.querySelector(".card-title");
    if (!title) {
      return;
    }

    title.contentEditable = "true";
    title.setAttribute("aria-label", "Edit card title");
    title.focus();
    this.placeCaretAtEnd(title);
  }

  updateEmptyStates() {
    this.columns.forEach((column) => {
      const list = this.boardElement.querySelector(`.card-list[data-column-id="${column.id}"]`);
      if (!list) {
        return;
      }

      const existingEmptyState = list.querySelector(".empty-state");
      const visibleCards = [...list.querySelectorAll(".kanban-card")].filter((card) => !card.classList.contains("hidden-by-search"));
      const shouldShowEmpty = visibleCards.length === 0 && !this.dropIndicator.parentElement;

      if (shouldShowEmpty && !existingEmptyState) {
        list.appendChild(this.createEmptyState(column));
      }

      if (!shouldShowEmpty && existingEmptyState) {
        existingEmptyState.remove();
      }
    });
  }

  createEmptyState(column) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.setAttribute("aria-hidden", "true");
    empty.innerHTML = `
      <div>
        <div class="empty-art"><span></span></div>
        <p>${this.searchInput.value.trim() ? "No matching cards" : `${column.title} is clear`}</p>
      </div>
    `;
    return empty;
  }

  createDropIndicator() {
    const indicator = document.createElement("div");
    indicator.className = "drop-indicator";
    indicator.setAttribute("aria-hidden", "true");
    return indicator;
  }

  getCardAfterPointer(list, pointerY) {
    const draggableCards = [...list.querySelectorAll(".kanban-card:not(.dragging):not(.hidden-by-search)")];

    return draggableCards.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = pointerY - box.top - box.height / 2;

      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      }

      return closest;
    }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
  }

  removeCardById(cardId) {
    for (const column of this.columns) {
      const index = column.cards.findIndex((card) => card.id === cardId);
      if (index !== -1) {
        const [card] = column.cards.splice(index, 1);
        return card;
      }
    }

    return null;
  }

  findCard(cardId) {
    return this.columns.flatMap((column) => column.cards).find((card) => card.id === cardId);
  }

  clearColumnHover() {
    this.boardElement.querySelectorAll(".column-over").forEach((column) => {
      column.classList.remove("column-over");
    });
  }

  applySavedTheme() {
    const savedTheme = localStorage.getItem(this.themeKey);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = savedTheme || (prefersDark ? "dark" : "light");
    document.documentElement.dataset.theme = theme;
    this.themeToggle.setAttribute("aria-label", `Switch to ${theme === "dark" ? "light" : "dark"} mode`);
  }

  showToast(message) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    this.toastRegion.appendChild(toast);

    window.setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      window.setTimeout(() => toast.remove(), 180);
    }, 2400);
  }

  placeCaretAtEnd(element) {
    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  generateId() {
    if (window.crypto?.randomUUID) {
      return `card-${window.crypto.randomUUID().slice(0, 8)}`;
    }

    return `card-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  }

  formatDate(value) {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  }
}

let kanbanBoard;

document.addEventListener("DOMContentLoaded", () => {
  kanbanBoard = new KanbanBoard();
});

function saveBoard() {
  return kanbanBoard.saveBoard();
}

function loadBoard() {
  return kanbanBoard.loadBoard();
}

function createCard(title) {
  return kanbanBoard.createCard(title);
}

function deleteCard(cardId) {
  return kanbanBoard.deleteCard(cardId);
}

function editCard(cardId, value) {
  return kanbanBoard.editCard(cardId, value);
}

function dragStart(event) {
  return kanbanBoard.dragStart(event);
}

function dragEnd(event) {
  return kanbanBoard.dragEnd(event);
}

function allowDrop(event) {
  return kanbanBoard.allowDrop(event);
}

function dropCard(event) {
  return kanbanBoard.dropCard(event);
}

function updateCounters() {
  return kanbanBoard.updateCounters();
}

function toggleTheme() {
  return kanbanBoard.toggleTheme();
}

function searchCards() {
  return kanbanBoard.searchCards();
}
