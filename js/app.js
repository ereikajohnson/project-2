

document.addEventListener("DOMContentLoaded", function () {
    if (!window.BudgetWatchStore) {
        console.error("Please load js/data.js before js/app.js.");
        return;
    }

    let data = window.BudgetWatchStore.load();

    const currentPage = document.body.dataset.page || "";

    // ---------- COMMON FUNCTIONS ----------

    function save() {
        window.BudgetWatchStore.save(data);
    }

    function getElement(id) {
        return document.getElementById(id);
    }

    function setText(id, value) {
        const element = getElement(id);
        if (element) element.textContent = value;
    }

    function formatMoney(amount) {
        return Number(amount || 0).toLocaleString("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0
        });
    }

    function formatNumber(amount) {
        return Number(amount || 0).toLocaleString("en-IN");
    }

    function formatDate(date) {
        if (!date) return "-";

        const parsed = new Date(date + "T00:00:00");

        if (Number.isNaN(parsed.getTime())) return date;

        return parsed.toLocaleDateString("en-IN");
    }

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, function (character) {
            return {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            }[character];
        });
    }

    function showMessage(id, message, isError) {
        const element = getElement(id);

        if (!element) return;

        element.textContent = message;
        element.style.color = isError ? "#b42318" : "#16803c";
    }

    function addAudit(action) {
        data.auditLog.unshift({
            action: action,
            date: new Date().toLocaleString(),
            user: "Demo Administrator"
        });

        data.auditLog = data.auditLog.slice(0, 100);
        save();
    }

    function selectedYear(id) {
        const element = getElement(id);
        return element ? element.value : "2026-27";
    }

    function getBudgetById(id) {
        return data.budgets.find(function (budget) {
            return String(budget.id) === String(id);
        });
    }

    function getExpenseYear(expense) {
        const budget = getBudgetById(expense.budgetId);

        if (budget) return budget.year;

        const year = Number(String(expense.date || "").slice(0, 4));

        return year >= 2026 ? "2026-27" : "2025-26";
    }

    function expensesForYear(year) {
        return data.expenditures.filter(function (expense) {
            return getExpenseYear(expense) === year;
        });
    }

    function budgetSpent(budget) {
        return data.expenditures
            .filter(function (expense) {
                return String(expense.budgetId) === String(budget.id);
            })
            .reduce(function (total, expense) {
                return total + Number(expense.amount || 0);
            }, 0);
    }

    function departmentSpent(department, year) {
        return expensesForYear(year)
            .filter(function (expense) {
                return expense.department === department;
            })
            .reduce(function (total, expense) {
                return total + Number(expense.amount || 0);
            }, 0);
    }

    function percentage(spent, allocated) {
        return allocated > 0 ? (spent / allocated) * 100 : 0;
    }

    function getAnomalies(year) {
        const budgets = data.budgets.filter(function (budget) {
            return budget.year === year;
        });

        const anomalies = [];

        budgets.forEach(function (budget) {
            const spent = budgetSpent(budget);
            const rate = percentage(spent, budget.amount);

            if (spent > budget.amount) {
                anomalies.push({
                    department: budget.department,
                    type: "Overspending",
                    severity: "High",
                    amount: spent - budget.amount,
                    description: "Expenditure exceeds the allocated budget."
                });
            } else if (
                rate < Number(data.thresholds.underUtilization) &&
                rate < 100
            ) {
                anomalies.push({
                    department: budget.department,
                    type: "Low Utilization",
                    severity: "Medium",
                    amount: budget.amount - spent,
                    description: "Budget utilization is below the configured threshold."
                });
            }
        });

        const expenses = expensesForYear(year);

        const totalsByDepartment = {};

        expenses.forEach(function (expense) {
            totalsByDepartment[expense.department] =
                (totalsByDepartment[expense.department] || 0) +
                Number(expense.amount || 0);
        });

        Object.keys(totalsByDepartment).forEach(function (department) {
            const departmentExpenses = expenses.filter(function (expense) {
                return expense.department === department;
            });

            if (departmentExpenses.length < 2) return;

            const amounts = departmentExpenses.map(function (expense) {
                return Number(expense.amount || 0);
            });

            const average = amounts.reduce(function (sum, amount) {
                return sum + amount;
            }, 0) / amounts.length;

            departmentExpenses.forEach(function (expense) {
                if (
                    average > 0 &&
                    Number(expense.amount) >=
                    average * (1 + Number(data.thresholds.spike) / 100)
                ) {
                    anomalies.push({
                        department: department,
                        type: "Spending Spike",
                        severity: "Medium",
                        amount: Number(expense.amount),
                        description: "An expenditure is higher than the configured spending comparison threshold."
                    });
                }
            });
        });

        return anomalies;
    }

    function getAlerts(year) {
        return getAnomalies(year).map(function (anomaly, index) {
            const key = [
                year,
                anomaly.department,
                anomaly.type,
                anomaly.amount
            ].join("|");

            return {
                id: key + "|" + index,
                department: anomaly.department,
                type: anomaly.type,
                severity: anomaly.severity,
                message: anomaly.description,
                reviewed: data.reviewedAlerts.includes(key),
                key: key
            };
        });
    }

    function renderTable(id, rows, emptyMessage, columns) {
        const tbody = getElement(id);

        if (!tbody) return;

        if (!rows.length) {
            tbody.innerHTML =
                '<tr><td colspan="' + columns + '">' +
                escapeHTML(emptyMessage) +
                "</td></tr>";
            return;
        }

        tbody.innerHTML = rows.join("");
    }

    function getSearchValue(id) {
        const element = getElement(id);
        return element ? element.value.trim().toLowerCase() : "";
    }

    // ---------- DASHBOARD ----------

    function renderDashboard() {
        const year = selectedYear("financialYear");
        const budgets = data.budgets.filter(function (budget) {
            return budget.year === year;
        });

        const expenses = expensesForYear(year);

        const allocated = budgets.reduce(function (sum, budget) {
            return sum + Number(budget.amount || 0);
        }, 0);

        const spent = expenses.reduce(function (sum, expense) {
            return sum + Number(expense.amount || 0);
        }, 0);

        const rate = percentage(spent, allocated);
        const alerts = getAlerts(year).filter(function (alert) {
            return !alert.reviewed;
        });

        setText("totalBudget", formatMoney(allocated));
        setText("totalExpenditure", formatMoney(spent));
        setText("utilizationRate", rate.toFixed(1) + "%");
        setText("activeAlerts", alerts.length);
        setText("circleUtilization", rate.toFixed(1) + "%");
        setText("remainingBudget", formatMoney(allocated - spent));

        const circle = getElement("progressCircle");

        if (circle) {
            const progress = Math.max(0, Math.min(rate, 100));

            circle.style.background =
                "conic-gradient(#b88936 " + progress +
                "%, #e8e8e8 " + progress + "%)";
        }

        const search = getSearchValue("departmentSearch");

        const rows = budgets
            .filter(function (budget) {
                return budget.department.toLowerCase().includes(search);
            })
            .map(function (budget) {
                const departmentTotal = budgetSpent(budget);
                const utilization = percentage(
                    departmentTotal,
                    budget.amount
                );

                return "<tr>" +
                    "<td>" + escapeHTML(budget.department) + "</td>" +
                    "<td>" + formatMoney(budget.amount) + "</td>" +
                    "<td>" + formatMoney(departmentTotal) + "</td>" +
                    "<td>" + formatMoney(budget.amount - departmentTotal) + "</td>" +
                    "<td>" + utilization.toFixed(1) + "%</td>" +
                    "</tr>";
            });

        renderTable(
            "departmentTable",
            rows,
            "No department budgets found.",
            5
        );

        if (window.Chart && getElement("budgetChart")) {
            const canvas = getElement("budgetChart");

            if (window.budgetWatchChart) {
                window.budgetWatchChart.destroy();
            }

            window.budgetWatchChart = new Chart(canvas, {
                type: "bar",
                data: {
                    labels: budgets.map(function (budget) {
                        return budget.department;
                    }),
                    datasets: [
                        {
                            label: "Allocated Budget",
                            data: budgets.map(function (budget) {
                                return Number(budget.amount);
                            }),
                            backgroundColor: "#d9bd82"
                        },
                        {
                            label: "Expenditure",
                            data: budgets.map(function (budget) {
                                return budgetSpent(budget);
                            }),
                            backgroundColor: "#607d8b"
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }
    }

    // ---------- BUDGETS PAGE ----------

    function renderBudgets() {
        const search = getSearchValue("budgetSearch");

        const budgets = data.budgets.filter(function (budget) {
            return (
                budget.department.toLowerCase().includes(search) ||
                budget.purpose.toLowerCase().includes(search) ||
                budget.year.toLowerCase().includes(search)
            );
        });

        setText("budgetCount", data.budgets.length);

        setText(
            "budgetTotal",
            formatMoney(
                data.budgets.reduce(function (sum, budget) {
                    return sum + Number(budget.amount || 0);
                }, 0)
            )
        );

        const rows = budgets.map(function (budget) {
            return "<tr>" +
                "<td>" + escapeHTML(budget.id) + "</td>" +
                "<td>" + escapeHTML(budget.department) + "</td>" +
                "<td>" + escapeHTML(budget.year) + "</td>" +
                "<td>" + formatMoney(budget.amount) + "</td>" +
                "<td>" + formatDate(budget.date) + "</td>" +
                "<td>" + escapeHTML(budget.purpose) + "</td>" +
                "</tr>";
        });

        renderTable("budgetTable", rows, "No budgets found.", 6);
    }

    function setupBudgetForm() {
        const form = getElement("budgetForm");
        const panel = getElement("budgetFormPanel");

        const showButton = getElement("showBudgetForm");
        const cancelButton = getElement("cancelBudgetForm");

        if (showButton && panel) {
            showButton.addEventListener("click", function () {
                panel.classList.remove("hidden");
            });
        }

        if (cancelButton && panel) {
            cancelButton.addEventListener("click", function () {
                panel.classList.add("hidden");
                if (form) form.reset();
            });
        }

        if (!form) return;

        form.addEventListener("submit", function (event) {
            event.preventDefault();

            const department = getElement("budgetDepartment").value;
            const year = getElement("budgetYear").value;
            const amount = Number(getElement("budgetAmount").value);
            const date = getElement("budgetDate").value;
            const purpose = getElement("budgetPurpose").value.trim();

            if (
                !department ||
                !year ||
                !date ||
                !purpose ||
                !Number.isFinite(amount) ||
                amount <= 0
            ) {
                showMessage(
                    "budgetMessage",
                    "Enter valid budget details and an amount greater than zero.",
                    true
                );
                return;
            }

            data.budgets.push({
                id: Date.now(),
                department: department,
                year: year,
                amount: amount,
                date: date,
                purpose: purpose
            });

            addAudit("Added budget for " + department);
            save();

            form.reset();

            if (panel) panel.classList.add("hidden");

            showMessage(
                "budgetMessage",
                "Budget added successfully.",
                false
            );

            renderBudgets();
        });
    }

    // ---------- EXPENDITURES PAGE ----------

    function renderExpenditures() {
        const search = getSearchValue("expenseSearch");

        const expenses = data.expenditures.filter(function (expense) {
            return (
                expense.department.toLowerCase().includes(search) ||
                expense.category.toLowerCase().includes(search) ||
                expense.reference.toLowerCase().includes(search) ||
                expense.description.toLowerCase().includes(search)
            );
        });

        const total = data.expenditures.reduce(function (sum, expense) {
            return sum + Number(expense.amount || 0);
        }, 0);

        const categories = new Set(data.expenditures.map(function (expense) {
            return expense.category;
        }));

        const reviewCount = data.expenditures.filter(function (expense) {
            return expense.amount > 0 && !expense.reference;
        }).length;

        setText("expenseCount", data.expenditures.length);
        setText("expenseTotal", formatMoney(total));
        setText("categoryCount", categories.size);
        setText("expenseReviewCount", reviewCount);

        const rows = expenses.map(function (expense) {
            return "<tr>" +
                "<td>" + escapeHTML(expense.reference || "-") + "</td>" +
                "<td>" + escapeHTML(expense.department) + "</td>" +
                "<td>" + escapeHTML(expense.category) + "</td>" +
                "<td>" + formatMoney(expense.amount) + "</td>" +
                "<td>" + formatDate(expense.date) + "</td>" +
                "<td>" + escapeHTML(expense.description || "-") + "</td>" +
                "<td>" + escapeHTML(expense.documentName || "-") + "</td>" +
                "</tr>";
        });

        renderTable("expenseTable", rows, "No expenditures found.", 7);
    }

    function setupExpenseForm() {
        const form = getElement("expenseForm");
        const panel = getElement("expenseFormPanel");
        const showButton = getElement("showExpenseForm");
        const cancelButton = getElement("cancelExpenseForm");

        if (showButton && panel) {
            showButton.addEventListener("click", function () {
                panel.classList.remove("hidden");
            });
        }

        if (cancelButton && panel) {
            cancelButton.addEventListener("click", function () {
                panel.classList.add("hidden");
                if (form) form.reset();
            });
        }

        const departmentSelect = getElement("expenseDepartment");
        const budgetSelect = getElement("expenseBudgetId");

        function updateBudgetOptions() {
            if (!budgetSelect) return;

            const department = departmentSelect
                ? departmentSelect.value
                : "";

            const matchingBudgets = data.budgets.filter(function (budget) {
                return !department || budget.department === department;
            });

            budgetSelect.innerHTML =
                '<option value="">Select related budget</option>' +
                matchingBudgets.map(function (budget) {
                    return '<option value="' + escapeHTML(budget.id) + '">' +
                        escapeHTML(
                            budget.department + " — " +
                            budget.year + " — " +
                            formatMoney(budget.amount)
                        ) +
                        "</option>";
                }).join("");
        }

        if (departmentSelect) {
            departmentSelect.addEventListener("change", updateBudgetOptions);
        }

        updateBudgetOptions();

        if (!form) return;

        form.addEventListener("submit", function (event) {
            event.preventDefault();

            const department = getElement("expenseDepartment").value;
            const category = getElement("expenseCategory").value;
            const amount = Number(getElement("expenseAmount").value);
            const date = getElement("expenseDate").value;
            const reference = getElement("expenseReference").value.trim();
            const budgetId = getElement("expenseBudgetId").value;
            const description = getElement("expenseDescription").value.trim();
            const fileInput = getElement("expenseDocument");
            const documentName =
                fileInput && fileInput.files.length
                    ? fileInput.files[0].name
                    : "";

            if (
                !department ||
                !category ||
                !date ||
                !reference ||
                !description ||
                !Number.isFinite(amount) ||
                amount <= 0
            ) {
                showMessage(
                    "expenseMessage",
                    "Complete all required fields and enter a valid amount.",
                    true
                );
                return;
            }

            const linkedBudget = budgetId ? getBudgetById(budgetId) : null;

            if (budgetId && !linkedBudget) {
                showMessage(
                    "expenseMessage",
                    "Select a valid budget.",
                    true
                );
                return;
            }

            if (linkedBudget && linkedBudget.department !== department) {
                showMessage(
                    "expenseMessage",
                    "Choose a budget belonging to the selected department.",
                    true
                );
                return;
            }

            data.expenditures.push({
                id: Date.now(),
                department: department,
                category: category,
                amount: amount,
                date: date,
                reference: reference,
                budgetId: budgetId || null,
                description: description,
                documentName: documentName
            });

            addAudit("Added expenditure " + reference);
            save();

            form.reset();
            updateBudgetOptions();

            if (panel) panel.classList.add("hidden");

            showMessage(
                "expenseMessage",
                "Expenditure added successfully.",
                false
            );

            renderExpenditures();
        });
    }

    // ---------- ANOMALIES PAGE ----------

    function renderAnomalies() {
        const year = "2026-27";
        const anomalies = getAnomalies(year);
        const search = getSearchValue("anomalySearch");

        setText("anomalyCount", anomalies.length);

        setText(
            "highAnomalyCount",
            anomalies.filter(function (item) {
                return item.severity === "High";
            }).length
        );

        setText(
            "underUtilizedCount",
            anomalies.filter(function (item) {
                return item.type === "Low Utilization";
            }).length
        );

        setText(
            "overspendingCount",
            anomalies.filter(function (item) {
                return item.type === "Overspending";
            }).length
        );

        const filtered = anomalies.filter(function (item) {
            return (
                item.department.toLowerCase().includes(search) ||
                item.type.toLowerCase().includes(search) ||
                item.severity.toLowerCase().includes(search)
            );
        });

        const rows = filtered.map(function (item) {
            return "<tr>" +
                "<td>" + escapeHTML(item.department) + "</td>" +
                "<td>" + escapeHTML(item.type) + "</td>" +
                "<td>" + escapeHTML(item.severity) + "</td>" +
                "<td>" + formatMoney(item.amount) + "</td>" +
                "<td>" + escapeHTML(item.description) + "</td>" +
                "</tr>";
        });

        renderTable("anomalyTable", rows, "No anomalies detected.", 5);
    }

    // ---------- ALERTS PAGE ----------

    function renderAlerts() {
        const year = "2026-27";
        let alerts = getAlerts(year);

        const statusFilter = getElement("alertStatusFilter");
        const severityFilter = getElement("alertSeverityFilter");

        const status = statusFilter ? statusFilter.value : "All";
        const severity = severityFilter ? severityFilter.value : "All";
        const search = getSearchValue("alertSearch");

        setText("alertTotal", alerts.length);

        setText(
            "alertHigh",
            alerts.filter(function (alert) {
                return alert.severity === "High";
            }).length
        );

        setText(
            "alertPending",
            alerts.filter(function (alert) {
                return !alert.reviewed;
            }).length
        );

        setText(
            "alertReviewed",
            alerts.filter(function (alert) {
                return alert.reviewed;
            }).length
        );

        alerts = alerts.filter(function (alert) {
            const matchesStatus =
                status === "All" ||
                (status === "Pending" && !alert.reviewed) ||
                (status === "Reviewed" && alert.reviewed);

            const matchesSeverity =
                severity === "All" || alert.severity === severity;

            const matchesSearch =
                alert.department.toLowerCase().includes(search) ||
                alert.type.toLowerCase().includes(search) ||
                alert.message.toLowerCase().includes(search);

            return matchesStatus && matchesSeverity && matchesSearch;
        });

        const rows = alerts.map(function (alert) {
            const action = alert.reviewed
                ? '<span>Reviewed</span>'
                : '<button type="button" class="review-alert" data-alert-key="' +
                    escapeHTML(alert.key) + '">Mark reviewed</button>';

            return "<tr>" +
                "<td>" + escapeHTML(alert.department) + "</td>" +
                "<td>" + escapeHTML(alert.type) + "</td>" +
                "<td>" + escapeHTML(alert.severity) + "</td>" +
                "<td>" + escapeHTML(alert.message) + "</td>" +
                "<td>" + action + "</td>" +
                "</tr>";
        });

        renderTable("alertTable", rows, "No alerts match your filters.", 5);

        document.querySelectorAll(".review-alert").forEach(function (button) {
            button.addEventListener("click", function () {
                const key = button.dataset.alertKey;

                if (!data.reviewedAlerts.includes(key)) {
                    data.reviewedAlerts.push(key);
                }

                addAudit("Reviewed alert");
                renderAlerts();
            });
        });
    }

    function setupAlerts() {
        ["alertStatusFilter", "alertSeverityFilter", "alertSearch"].forEach(
            function (id) {
                const element = getElement(id);

                if (element) {
                    element.addEventListener("input", renderAlerts);
                    element.addEventListener("change", renderAlerts);
                }
            }
        );

        const markAllButton = getElement("markAllRead");

        if (markAllButton) {
            markAllButton.addEventListener("click", function () {
                getAlerts("2026-27").forEach(function (alert) {
                    if (!data.reviewedAlerts.includes(alert.key)) {
                        data.reviewedAlerts.push(alert.key);
                    }
                });

                addAudit("Marked all alerts as reviewed");
                renderAlerts();
            });
        }
    }

    // ---------- REPORTS PAGE ----------

    function renderReports() {
        const year = selectedYear("reportYear");
        const departmentSelect = getElement("reportDepartment");
        const reportTypeSelect = getElement("reportType");

        const department = departmentSelect
            ? departmentSelect.value
            : "All";

        const reportType = reportTypeSelect
            ? reportTypeSelect.value
            : "All";

        let budgets = data.budgets.filter(function (budget) {
            return budget.year === year;
        });

        if (department !== "All") {
            budgets = budgets.filter(function (budget) {
                return budget.department === department;
            });
        }

        const allocated = budgets.reduce(function (sum, budget) {
            return sum + Number(budget.amount || 0);
        }, 0);

        const relevantExpenses = expensesForYear(year).filter(function (expense) {
            return department === "All" || expense.department === department;
        });

        const spent = relevantExpenses.reduce(function (sum, expense) {
            return sum + Number(expense.amount || 0);
        }, 0);

        const rate = percentage(spent, allocated);

        setText("reportAllocated", formatMoney(allocated));
        setText("reportSpent", formatMoney(spent));
        setText("reportRemaining", formatMoney(allocated - spent));
        setText("reportUtilization", rate.toFixed(1) + "%");

        let rows = [];

        if (reportType === "Expenditure Details") {
            rows = relevantExpenses.map(function (expense) {
                return "<tr>" +
                    "<td>" + escapeHTML(expense.department) + "</td>" +
                    "<td>" + escapeHTML(expense.category) + "</td>" +
                    "<td>" + formatMoney(expense.amount) + "</td>" +
                    "<td>" + formatDate(expense.date) + "</td>" +
                    "<td>" + escapeHTML(expense.reference) + "</td>" +
                    "</tr>";
            });
        } else {
            rows = budgets.map(function (budget) {
                const amountSpent = budgetSpent(budget);
                const utilization = percentage(amountSpent, budget.amount);

                return "<tr>" +
                    "<td>" + escapeHTML(budget.department) + "</td>" +
                    "<td>" + formatMoney(budget.amount) + "</td>" +
                    "<td>" + formatMoney(amountSpent) + "</td>" +
                    "<td>" + formatMoney(budget.amount - amountSpent) + "</td>" +
                    "<td>" + utilization.toFixed(1) + "%</td>" +
                    "</tr>";
            });
        }

        renderTable("reportTable", rows, "No report data available.", 5);

        if (window.Chart && getElement("reportChart")) {
            if (window.budgetWatchReportChart) {
                window.budgetWatchReportChart.destroy();
            }

            window.budgetWatchReportChart = new Chart(
                getElement("reportChart"),
                {
                    type: "doughnut",
                    data: {
                        labels: ["Expenditure", "Remaining Budget"],
                        datasets: [{
                            data: [
                                Math.max(0, spent),
                                Math.max(0, allocated - spent)
                            ],
                            backgroundColor: ["#607d8b", "#d9bd82"]
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false
                    }
                }
            );
        }
    }

    function setupReports() {
        ["reportYear", "reportDepartment", "reportType"].forEach(
            function (id) {
                const element = getElement(id);

                if (element) {
                    element.addEventListener("change", renderReports);
                }
            }
        );

        const generateButton = getElement("generateReport");

        if (generateButton) {
            generateButton.addEventListener("click", function () {
                renderReports();
                showMessage(
                    "reportMessage",
                    "Report generated successfully.",
                    false
                );
            });
        }

        const exportButton = getElement("exportReport");

        if (exportButton) {
            exportButton.addEventListener("click", exportCSV);
        }
    }

    function exportCSV() {
        const table = getElement("reportTable");

        if (!table) {
            showMessage("reportMessage", "Report table not found.", true);
            return;
        }

        const rows = Array.from(table.querySelectorAll("tr"));

        if (!rows.length) {
            showMessage("reportMessage", "There is no report data to export.", true);
            return;
        }

        const csv = rows.map(function (row) {
            return Array.from(row.querySelectorAll("th, td"))
                .map(function (cell) {
                    return '"' + cell.textContent.trim().replace(/"/g, '""') + '"';
                })
                .join(",");
        }).join("\r\n");

        const blob = new Blob(["\uFEFF" + csv], {
            type: "text/csv;charset=utf-8;"
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = "BudgetWatch_Report.csv";
        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);

        showMessage("reportMessage", "CSV report exported.", false);
    }

    // ---------- ADMIN PAGE ----------

    function renderAdmin() {
        const departmentRows = data.departments.map(function (department) {
            return "<tr><td>" + escapeHTML(department) + "</td></tr>";
        });

        renderTable(
            "departmentAdminTable",
            departmentRows,
            "No departments added.",
            1
        );

        const users = [
            ["Demo Administrator", "Administrator", "Demo account"],
            ["Demo Officer", "Department Officer", "Demo account"]
        ];

        renderTable(
            "userAdminTable",
            users.map(function (user) {
                return "<tr>" +
                    "<td>" + escapeHTML(user[0]) + "</td>" +
                    "<td>" + escapeHTML(user[1]) + "</td>" +
                    "<td>" + escapeHTML(user[2]) + "</td>" +
                    "</tr>";
            }),
            "No demo users available.",
            3
        );

        renderTable(
            "auditTable",
            data.auditLog.map(function (entry) {
                return "<tr>" +
                    "<td>" + escapeHTML(entry.date) + "</td>" +
                    "<td>" + escapeHTML(entry.user) + "</td>" +
                    "<td>" + escapeHTML(entry.action) + "</td>" +
                    "</tr>";
            }),
            "No activity recorded yet.",
            3
        );

        const under = getElement("underUtilizationThreshold");
        const elapsed = getElement("elapsedTimeThreshold");
        const spike = getElement("spikeThreshold");

        if (under && under.value === "") {
            under.value = data.thresholds.underUtilization;
        }

        if (elapsed && elapsed.value === "") {
            elapsed.value = data.thresholds.elapsedTime;
        }

        if (spike && spike.value === "") {
            spike.value = data.thresholds.spike;
        }
    }

    function setupAdmin() {
        const departmentForm = getElement("departmentForm");

        if (departmentForm) {
            departmentForm.addEventListener("submit", function (event) {
                event.preventDefault();

                const input = getElement("newDepartment");
                const department = input.value.trim();

                if (!department) {
                    showMessage(
                        "departmentMessage",
                        "Enter a department name.",
                        true
                    );
                    return;
                }

                const exists = data.departments.some(function (item) {
                    return item.toLowerCase() === department.toLowerCase();
                });

                if (exists) {
                    showMessage(
                        "departmentMessage",
                        "This department already exists.",
                        true
                    );
                    return;
                }

                data.departments.push(department);
                addAudit("Added department " + department);

                input.value = "";

                showMessage(
                    "departmentMessage",
                    "Department added successfully.",
                    false
                );

                renderAdmin();
            });
        }

        const thresholdForm = getElement("thresholdForm");

        if (thresholdForm) {
            thresholdForm.addEventListener("submit", function (event) {
                event.preventDefault();

                const under = Number(
                    getElement("underUtilizationThreshold").value
                );

                const elapsed = Number(
                    getElement("elapsedTimeThreshold").value
                );

                const spike = Number(
                    getElement("spikeThreshold").value
                );

                if (
                    !Number.isFinite(under) ||
                    !Number.isFinite(elapsed) ||
                    !Number.isFinite(spike) ||
                    under < 0 || under > 100 ||
                    elapsed < 0 || elapsed > 100 ||
                    spike < 0
                ) {
                    showMessage(
                        "thresholdMessage",
                        "Enter valid thresholds. Percentages must be between 0 and 100.",
                        true
                    );
                    return;
                }

                data.thresholds.underUtilization = under;
                data.thresholds.elapsedTime = elapsed;
                data.thresholds.spike = spike;

                addAudit("Updated anomaly detection thresholds");

                showMessage(
                    "thresholdMessage",
                    "Threshold settings saved.",
                    false
                );
            });
        }
    }

    // ---------- LOGIN PAGE ----------

    function setupLogin() {
        const form = getElement("loginForm");

        if (!form) return;

        form.addEventListener("submit", function (event) {
            event.preventDefault();

            const email = getElement("loginEmail").value.trim();
            const password = getElement("loginPassword").value;

            if (!email || !password) {
                showMessage(
                    "loginMessage",
                    "Enter your email and password.",
                    true
                );
                return;
            }

            showMessage(
                "loginMessage",
                "Demo login successful. Opening dashboard...",
                false
            );

            // Frontend demonstration only.
            // This is not secure authentication.
            window.location.href = "index.html";
        });
    }

    // ---------- SEARCH LISTENERS ----------

    function setupSearch(id, renderFunction) {
        const input = getElement(id);

        if (input) {
            input.addEventListener("input", renderFunction);
        }
    }

    // ---------- START THE CURRENT PAGE ----------

    switch (currentPage) {
        case "dashboard":
            setupSearch("departmentSearch", renderDashboard);

            if (getElement("financialYear")) {
                getElement("financialYear").addEventListener(
                    "change",
                    renderDashboard
                );
            }

            renderDashboard();
            break;

        case "budgets":
            setupBudgetForm();
            setupSearch("budgetSearch", renderBudgets);
            renderBudgets();
            break;

        case "expenditures":
            setupExpenseForm();
            setupSearch("expenseSearch", renderExpenditures);
            renderExpenditures();
            break;

        case "anomalies":
            setupSearch("anomalySearch", renderAnomalies);

            const runButton = getElement("runAnomalyCheck");

            if (runButton) {
                runButton.addEventListener("click", function () {
                    renderAnomalies();
                    showMessage(
                        "anomalyMessage",
                        "Anomaly check completed using the current demo data and thresholds.",
                        false
                    );
                });
            }

            renderAnomalies();
            break;

        case "alerts":
            setupAlerts();
            renderAlerts();
            break;

        case "reports":
            setupReports();
            renderReports();
            break;

        case "admin":
            setupAdmin();
            renderAdmin();
            break;

        case "login":
            setupLogin();
            break;

        default:
            console.log("BudgetWatch page:", currentPage);
    }
});
