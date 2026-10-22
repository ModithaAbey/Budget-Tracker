
const form = document.getElementById("transaction-form");
const transactionList = document.getElementById("transaction-list");
const message = document.getElementById("message");

const typeInput = document.getElementById("type");
const descriptionInput = document.getElementById("description");
const amountInput = document.getElementById("amount");
const categoryInput = document.getElementById("category");
const dateInput = document.getElementById("date");

const filterType = document.getElementById("filter-type");
const filterCategory = document.getElementById("filter-category");

let editingId = null;

// Show today's date in the form
dateInput.value = new Date().toLocaleDateString("en-CA");

// Format amounts as Sri Lankan rupees
function formatMoney(amount) {
    return "Rs. " + Number(amount).toLocaleString("en-LK", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Display messages
function showMessage(text, isError = false) {
    message.textContent = text;
    message.style.color = isError ? "#dc2626" : "#15803d";
}

// Load income, expenses and balance
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
        console.error(error);
        showMessage("Could not load summary. Check your Flask backend.", true);
    }
}

// Load and display transactions
async function loadTransactions() {
    try {
        const params = new URLSearchParams();

        if (filterType.value) {
            params.append("type", filterType.value);
        }

        if (filterCategory.value.trim()) {
            params.append("category", filterCategory.value.trim());
        }

        const response = await fetch("/api/transactions?" + params.toString());

        if (!response.ok) {
            throw new Error("Could not load transactions.");
        }

        const data = await response.json();

        const transactions = Array.isArray(data)
            ? data
            : (data.transactions || []);

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

        transactions.forEach(transaction => {
            const row = document.createElement("tr");

            const dateCell = document.createElement("td");
            dateCell.textContent = transaction.date;

            const typeCell = document.createElement("td");
            typeCell.textContent = transaction.type;

            const descriptionCell = document.createElement("td");
            descriptionCell.textContent = transaction.description;

            const categoryCell = document.createElement("td");
            categoryCell.textContent = transaction.category;

            const amountCell = document.createElement("td");
            amountCell.textContent = formatMoney(transaction.amount);

            const actionsCell = document.createElement("td");

            const editButton = document.createElement("button");
            editButton.type = "button";
            editButton.textContent = "Edit";
            editButton.addEventListener("click", () => {
                editTransaction(transaction.id);
            });

            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.textContent = "Delete";
            deleteButton.style.backgroundColor = "#dc2626";
            deleteButton.addEventListener("click", () => {
                deleteTransaction(transaction.id);
            });

            actionsCell.append(editButton, deleteButton);

            row.append(
                dateCell,
                typeCell,
                descriptionCell,
                categoryCell,
                amountCell,
                actionsCell
            );

            transactionList.appendChild(row);
        });

    } catch (error) {
        console.error(error);
        transactionList.replaceChildren();

        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 6;
        cell.textContent = "Error loading transactions.";

        row.appendChild(cell);
        transactionList.appendChild(row);
    }
}

// Add a new transaction or update an existing one
form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const transaction = {
        type: typeInput.value,
        description: descriptionInput.value.trim(),
        amount: Number(amountInput.value),
        category: categoryInput.value.trim(),
        date: dateInput.value
    };

    if (
        !transaction.description ||
        !transaction.category ||
        !transaction.date ||
        !Number.isFinite(transaction.amount) ||
        transaction.amount <= 0
    ) {
        showMessage("Please enter valid information in every field.", true);
        return;
    }

    const url = editingId === null
        ? "/api/transactions"
        : `/api/transactions/${editingId}`;

    const method = editingId === null ? "POST" : "PUT";

    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(transaction)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || result.message || "Unable to save transaction.");
        }

        showMessage(
            editingId === null
                ? "Transaction added successfully!"
                : "Transaction updated successfully!"
        );

        editingId = null;
        form.reset();
        dateInput.value = new Date().toLocaleDateString("en-CA");
        document.getElementById("submit-button").textContent =
            "Add Transaction";

        await loadTransactions();
        await loadSummary();

    } catch (error) {
        console.error(error);
        showMessage(error.message, true);
    }
});

// Edit a transaction
async function editTransaction(id) {
    try {
        const response = await fetch(`/api/transactions/${id}`);

        if (!response.ok) {
            throw new Error("Could not find this transaction.");
        }

        const transaction = await response.json();
        const item = transaction.transaction || transaction;

        editingId = id;

        typeInput.value = item.type;
        descriptionInput.value = item.description;
        amountInput.value = item.amount;
        categoryInput.value = item.category;
        dateInput.value = item.date;

        document.getElementById("submit-button").textContent =
            "Update Transaction";

        showMessage("Edit the details, then click Update Transaction.");
        form.scrollIntoView({ behavior: "smooth" });

    } catch (error) {
        console.error(error);
        showMessage(error.message, true);
    }
}

// Delete a transaction
async function deleteTransaction(id) {
    const confirmed = confirm(
        "Are you sure you want to delete this transaction?"
    );

    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch(`/api/transactions/${id}`, {
            method: "DELETE"
        });

        if (!response.ok) {
            const result = await response.json();
            throw new Error(result.error || "Could not delete transaction.");
        }

        showMessage("Transaction deleted successfully!");

        await loadTransactions();
        await loadSummary();

    } catch (error) {
        console.error(error);
        showMessage(error.message, true);
    }
}

// Update the transaction list when filters change
filterType.addEventListener("change", loadTransactions);

filterCategory.addEventListener("input", loadTransactions);

// Load everything when the page opens
async function initializeApp() {
    await loadTransactions();
    await loadSummary();
}

initializeApp();
