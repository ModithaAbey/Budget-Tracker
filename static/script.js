
const form = document.getElementById("transaction-form");
const transactionList = document.getElementById("transaction-list");
const message = document.getElementById("message");

const typeInput = document.getElementById("type");
const descriptionInput = document.getElementById("description");
const amountInput = document.getElementById("amount");
const categoryInput = document.getElementById("category");
const dateInput = document.getElementById("date");
const submitButton = document.getElementById("submit-button");

const filterType = document.getElementById("filter-type");
const filterCategory = document.getElementById("filter-category");
const filterDate = document.getElementById("filter-date");
const customDateRange = document.getElementById("custom-date-range");
const startDateInput = document.getElementById("start-date");
const endDateInput = document.getElementById("end-date");

const transactionsPanel = document.getElementById("transactions-panel");

// Modal elements
const transactionModal = document.getElementById("transaction-modal");
const openAddModalButton = document.getElementById("open-add-modal");
const closeModalButton = document.getElementById("close-modal");
const cancelModalButton = document.getElementById("cancel-modal");
const modalTitle = document.getElementById("modal-title");

let editingId = null;
let allTransactions = [];

// Get today's date in local time.
function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

// Format amounts as Sri Lankan rupees.
function formatMoney(amount) {
    return "Rs. " + Number(amount || 0).toLocaleString("en-LK", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Display success or error messages.
function showMessage(text, isError = false) {
    message.textContent = text;
    message.style.color = isError ? "#dc2626" : "#15803d";
}

// Open the modal.
function openTransactionModal() {
    transactionModal.style.display = "flex";
    document.body.classList.add("modal-open");

    descriptionInput.focus();
}

// Close the modal.
function closeTransactionModal() {
    transactionModal.style.display = "none";
    document.body.classList.remove("modal-open");
}

// Open a blank form for adding a transaction.
openAddModalButton.addEventListener("click", function () {
    editingId = null;
    form.reset();

    dateInput.value = getLocalDateString();

    modalTitle.textContent = "Add a Transaction";
    submitButton.textContent = "Add Transaction";
    submitButton.disabled = false;

    openTransactionModal();
});

// Close using the X button.
closeModalButton.addEventListener("click", closeTransactionModal);

// Close using Cancel.
cancelModalButton.addEventListener("click", closeTransactionModal);

// Close when clicking the dark background.
transactionModal.addEventListener("click", function (event) {
    if (event.target === transactionModal) {
        closeTransactionModal();
    }
});

// Close using Escape.
document.addEventListener("keydown", function (event) {
    if (
        event.key === "Escape" &&
        transactionModal.style.display !== "none"
    ) {
        closeTransactionModal();
    }
});

// Load income, expenses and balance.
async function loadSummary() {
    try {
        const response = await fetch("/api/summary");

        if (!response.ok) {
            throw new Error("Could not load summary.");
        }

        const data = await response.json();

        document.getElementById("total-income").textContent =
            formatMoney(data.total_income ?? data.income ?? 0);

        document.getElementById("total-expenses").textContent =
            formatMoney(data.total_expenses ?? data.expenses ?? 0);

        document.getElementById("balance").textContent =
            formatMoney(data.balance ?? 0);

    } catch (error) {
        console.error("Summary error:", error);
        showMessage("Could not load summary. Check your Flask backend.", true);
    }
}

// Load transactions from the Flask API.
async function loadTransactions() {
    try {
        const params = new URLSearchParams();

        if (filterType.value) {
            params.append("type", filterType.value);
        }

        if (filterCategory.value) {
            params.append("category", filterCategory.value);
        }

        const query = params.toString();
        const url = query
            ? `/api/transactions?${query}`
            : "/api/transactions";

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Could not load transactions.");
        }

        const data = await response.json();

        allTransactions = Array.isArray(data)
            ? data
            : (data.transactions || []);

        applyDateFilter();

    } catch (error) {
        console.error("Transaction loading error:", error);

        transactionList.replaceChildren();

        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 6;
        cell.textContent = "Error loading transactions.";

        row.appendChild(cell);
        transactionList.appendChild(row);
    }
}

// Get the date range selected by the user.
function getDateRange() {
    const today = new Date();
    const todayString = getLocalDateString();
    const selected = filterDate.value;

    if (selected === "today") {
        return { start: todayString, end: todayString };
    }

    if (selected === "yesterday") {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const date = getLocalDateString(yesterday);

        return { start: date, end: date };
    }

    if (selected === "last7days") {
        const start = new Date(today);
        start.setDate(start.getDate() - 6);

        return {
            start: getLocalDateString(start),
            end: todayString
        };
    }

    if (selected === "lastmonth") {
        const firstDayThisMonth = new Date(
            today.getFullYear(),
            today.getMonth(),
            1
        );

        const lastDayPreviousMonth = new Date(firstDayThisMonth);
        lastDayPreviousMonth.setDate(0);

        const firstDayPreviousMonth = new Date(
            lastDayPreviousMonth.getFullYear(),
            lastDayPreviousMonth.getMonth(),
            1
        );

        return {
            start: getLocalDateString(firstDayPreviousMonth),
            end: getLocalDateString(lastDayPreviousMonth)
        };
    }

    if (selected === "custom") {
        return {
            start: startDateInput.value,
            end: endDateInput.value
        };
    }

    return null;
}

// Apply date filters to the loaded transactions.
function applyDateFilter() {
    const range = getDateRange();

    if (
        range &&
        range.start &&
        range.end &&
        range.start > range.end
    ) {
        transactionList.innerHTML =
            '<tr><td colspan="6">Start date must not be after end date.</td></tr>';
        return;
    }

    const filtered = allTransactions.filter(function (item) {
        const transactionDate = String(item.date || "").slice(0, 10);

        if (!range) {
            return true;
        }

        // Wait until both custom dates have been selected.
        if (!range.start || !range.end) {
            return true;
        }

        return (
            transactionDate >= range.start &&
            transactionDate <= range.end
        );
    });

    displayTransactions(filtered);
}

// Display the transactions table.
function displayTransactions(transactions) {
    transactionList.replaceChildren();

    if (transactions.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 6;
        cell.textContent = "No transactions found.";

        row.appendChild(cell);
        transactionList.appendChild(row);
        return;
    }

    transactions.forEach(function (transaction) {
        const row = document.createElement("tr");

        const values = [
            transaction.date,
            transaction.type,
            transaction.description,
            transaction.category,
            formatMoney(transaction.amount)
        ];

        values.forEach(function (value) {
            const cell = document.createElement("td");
            cell.textContent = value ?? "";
            row.appendChild(cell);
        });

        const actionsCell = document.createElement("td");

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.textContent = "Edit";
        editButton.addEventListener("click", function () {
            editTransaction(transaction.id);
        });

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.textContent = "Delete";
        deleteButton.style.backgroundColor = "#dc2626";
        deleteButton.addEventListener("click", function () {
            deleteTransaction(transaction.id);
        });

        actionsCell.append(editButton, deleteButton);
        row.appendChild(actionsCell);
        transactionList.appendChild(row);
    });
}

// Add a transaction or update an existing transaction.
form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const transaction = {
        type: typeInput.value,
        description: descriptionInput.value.trim(),
        amount: Number(amountInput.value),
        category: categoryInput.value,
        date: dateInput.value
    };

    if (
        !transaction.description ||
        !transaction.category ||
        !transaction.date ||
        !Number.isFinite(transaction.amount) ||
        transaction.amount <= 0
    ) {
        showMessage("Please complete all fields with valid information.", true);
        return;
    }

    const isEditing = editingId !== null;

    const url = isEditing
        ? `/api/transactions/${editingId}`
        : "/api/transactions";

    try {
        submitButton.disabled = true;
        submitButton.textContent = isEditing ? "Updating..." : "Saving...";

        const response = await fetch(url, {
            method: isEditing ? "PUT" : "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(transaction)
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                result.error ||
                result.message ||
                "Unable to save transaction."
            );
        }

        // Reset edit state after a successful save.
        editingId = null;
        form.reset();
        dateInput.value = getLocalDateString();

        submitButton.textContent = "Add Transaction";
        closeTransactionModal();

        // Show the table after saving.
        transactionsPanel.style.display = "block";

        showMessage(
            isEditing
                ? "Transaction updated successfully!"
                : "Transaction added successfully!"
        );

        await loadTransactions();
        await loadSummary();

    } catch (error) {
        console.error("Save error:", error);
        showMessage(error.message, true);

    } finally {
        submitButton.disabled = false;

        if (editingId === null) {
            submitButton.textContent = "Add Transaction";
        }
    }
});

// Edit an existing transaction.
async function editTransaction(id) {
    try {
        const response = await fetch(`/api/transactions/${id}`);

        if (!response.ok) {
            throw new Error("Could not find this transaction.");
        }

        const result = await response.json();
        const item = result.transaction || result;

        editingId = id;

        typeInput.value = item.type;
        descriptionInput.value = item.description;
        amountInput.value = item.amount;
        categoryInput.value = item.category;
        dateInput.value = String(item.date || "").slice(0, 10);

        modalTitle.textContent = "Edit Transaction";
        submitButton.textContent = "Update Transaction";

        transactionsPanel.style.display = "block";
        openTransactionModal();

    } catch (error) {
        console.error("Edit error:", error);
        showMessage(error.message, true);
    }
}

// Delete a transaction.
async function deleteTransaction(id) {
    if (!confirm("Are you sure you want to delete this transaction?")) {
        return;
    }

    try {
        const response = await fetch(`/api/transactions/${id}`, {
            method: "DELETE"
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                result.error || "Could not delete transaction."
            );
        }

        showMessage("Transaction deleted successfully!");

        await loadTransactions();
        await loadSummary();

    } catch (error) {
        console.error("Delete error:", error);
        showMessage(error.message, true);
    }
}

// Update the list when type or category changes.
filterType.addEventListener("change", loadTransactions);
filterCategory.addEventListener("change", loadTransactions);

// Show or hide the custom date inputs.
filterDate.addEventListener("change", function () {
    customDateRange.style.display =
        filterDate.value === "custom" ? "block" : "none";

    applyDateFilter();
});

startDateInput.addEventListener("change", applyDateFilter);
endDateInput.addEventListener("change", applyDateFilter);

// Initialize the page.
async function initializeApp() {
    dateInput.value = getLocalDateString();

    await loadTransactions();
    await loadSummary();
}

initializeApp();
