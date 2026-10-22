
from flask import Flask, jsonify, request, render_template
from database import init_db, get_connection
from datetime import datetime

app = Flask(
    __name__,
    static_folder="static",
    template_folder="static"
)

# Create the database table if it does not exist
init_db()


# -----------------------------
# HOME PAGE
# -----------------------------
@app.route("/")
def home():
    return render_template("index.html")


# -----------------------------
# TEST BACKEND
# -----------------------------
@app.route("/api/test", methods=["GET"])
def test():
    return jsonify({
        "message": "Expense Tracker backend is working!"
    })


# -----------------------------
# HELPER: VALIDATE TRANSACTION
# -----------------------------
def validate_transaction(data):
    if not isinstance(data, dict):
        return None, "Please send valid JSON data"

    transaction_type = data.get("type")
    description = data.get("description")
    amount = data.get("amount")
    category = data.get("category")
    transaction_date = data.get("date")

    if (
        not transaction_type
        or not description
        or amount is None
        or not category
        or not transaction_date
    ):
        return None, "All fields are required"

    if transaction_type not in ("income", "expense"):
        return None, "Type must be income or expense"

    if not isinstance(description, str) or not description.strip():
        return None, "Description cannot be empty"

    if not isinstance(category, str) or not category.strip():
        return None, "Category cannot be empty"

    try:
        amount = float(amount)
    except (ValueError, TypeError):
        return None, "Amount must be a number"

    if amount <= 0:
        return None, "Amount must be greater than zero"

    if not datetime.strptime(
        transaction_date, "%Y-%m-%d"
    ):
        return None, "Date must use YYYY-MM-DD format"

    return {
        "type": transaction_type,
        "description": description.strip(),
        "amount": amount,
        "category": category.strip(),
        "date": transaction_date
    }, None


# -----------------------------
# GET: VIEW ALL TRANSACTIONS
# -----------------------------
@app.route("/api/transactions", methods=["GET"])
def get_transactions():
    transaction_type = request.args.get("type", "").strip()
    category = request.args.get("category", "").strip()

    query = "SELECT * FROM transactions WHERE 1=1"
    parameters = []

    if transaction_type:
        if transaction_type not in ("income", "expense"):
            return jsonify({
                "error": "Invalid transaction type"
            }), 400

        query += " AND type = ?"
        parameters.append(transaction_type)

    if category:
        query += " AND LOWER(category) LIKE LOWER(?)"
        parameters.append(f"%{category}%")

    query += " ORDER BY date DESC, id DESC"

    connection = get_connection()

    try:
        rows = connection.execute(
            query, parameters
        ).fetchall()

        return jsonify([dict(row) for row in rows])

    finally:
        connection.close()


# -----------------------------
# GET: VIEW ONE TRANSACTION
# Required for the Edit button
# -----------------------------
@app.route("/api/transactions/<int:transaction_id>", methods=["GET"])
def get_transaction(transaction_id):
    connection = get_connection()

    try:
        row = connection.execute(
            "SELECT * FROM transactions WHERE id = ?",
            (transaction_id,)
        ).fetchone()

        if row is None:
            return jsonify({
                "error": "Transaction not found"
            }), 404

        return jsonify(dict(row))

    finally:
        connection.close()


# -----------------------------
# POST: ADD TRANSACTION
# -----------------------------
@app.route("/api/transactions", methods=["POST"])
def add_transaction():
    data, error = validate_transaction(
        request.get_json(silent=True)
    )

    if error:
        return jsonify({"error": error}), 400

    connection = get_connection()

    try:
        cursor = connection.execute(
            """
            INSERT INTO transactions
                (type, description, amount, category, date)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                data["type"],
                data["description"],
                data["amount"],
                data["category"],
                data["date"]
            )
        )

        connection.commit()

        return jsonify({
            "message": "Transaction added successfully",
            "id": cursor.lastrowid
        }), 201

    finally:
        connection.close()


# -----------------------------
# PUT: UPDATE TRANSACTION
# -----------------------------
@app.route("/api/transactions/<int:transaction_id>", methods=["PUT"])
def update_transaction(transaction_id):
    data, error = validate_transaction(
        request.get_json(silent=True)
    )

    if error:
        return jsonify({"error": error}), 400

    connection = get_connection()

    try:
        existing = connection.execute(
            "SELECT id FROM transactions WHERE id = ?",
            (transaction_id,)
        ).fetchone()

        if existing is None:
            return jsonify({
                "error": "Transaction not found"
            }), 404

        connection.execute(
            """
            UPDATE transactions
            SET type = ?,
                description = ?,
                amount = ?,
                category = ?,
                date = ?
            WHERE id = ?
            """,
            (
                data["type"],
                data["description"],
                data["amount"],
                data["category"],
                data["date"],
                transaction_id
            )
        )

        connection.commit()

        return jsonify({
            "message": "Transaction updated successfully"
        })

    finally:
        connection.close()


# -----------------------------
# DELETE: REMOVE TRANSACTION
# -----------------------------
@app.route("/api/transactions/<int:transaction_id>", methods=["DELETE"])
def delete_transaction(transaction_id):
    connection = get_connection()

    try:
        existing = connection.execute(
            "SELECT id FROM transactions WHERE id = ?",
            (transaction_id,)
        ).fetchone()

        if existing is None:
            return jsonify({
                "error": "Transaction not found"
            }), 404

        connection.execute(
            "DELETE FROM transactions WHERE id = ?",
            (transaction_id,)
        )

        connection.commit()

        return jsonify({
            "message": "Transaction deleted successfully"
        })

    finally:
        connection.close()


# -----------------------------
# GET: INCOME, EXPENSES, BALANCE
# -----------------------------
@app.route("/api/summary", methods=["GET"])
def get_summary():
    connection = get_connection()

    try:
        result = connection.execute(
            """
            SELECT
                COALESCE(
                    SUM(CASE
                        WHEN type = 'income' THEN amount
                        ELSE 0
                    END), 0
                ) AS total_income,

                COALESCE(
                    SUM(CASE
                        WHEN type = 'expense' THEN amount
                        ELSE 0
                    END), 0
                ) AS total_expenses

            FROM transactions
            """
        ).fetchone()

        total_income = result["total_income"]
        total_expenses = result["total_expenses"]

        return jsonify({
            "total_income": total_income,
            "total_expenses": total_expenses,
            "balance": total_income - total_expenses
        })

    finally:
        connection.close()


# -----------------------------
# START FLASK
# Keep this at the very bottom!
# -----------------------------
if __name__ == "__main__":
    app.run(debug=True)
