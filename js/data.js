
/* =====================================
   BudgetWatch - Demo Data
   File: js/data.js
===================================== */

(function () {
    const STORAGE_KEY = "budgetWatchData";

    const initialData = {
        departments: [
            "Health",
            "Education",
            "Public Works",
            "Agriculture",
            "Rural Development"
        ],

        budgets: [
            {
                id: 1,
                department: "Health",
                year: "2026-27",
                amount: 1500000,
                date: "2026-04-10",
                purpose: "Healthcare facilities"
            },
            {
                id: 2,
                department: "Education",
                year: "2026-27",
                amount: 1200000,
                date: "2026-04-12",
                purpose: "School development"
            },
            {
                id: 3,
                department: "Public Works",
                year: "2026-27",
                amount: 2000000,
                date: "2026-04-15",
                purpose: "Road maintenance"
            },
            {
                id: 4,
                department: "Agriculture",
                year: "2026-27",
                amount: 900000,
                date: "2026-04-18",
                purpose: "Farmer support"
            },
            {
                id: 5,
                department: "Rural Development",
                year: "2026-27",
                amount: 1000000,
                date: "2026-04-20",
                purpose: "Village development"
            },
            {
                id: 6,
                department: "Health",
                year: "2025-26",
                amount: 1300000,
                date: "2025-04-10",
                purpose: "Medical equipment"
            },
            {
                id: 7,
                department: "Education",
                year: "2025-26",
                amount: 1000000,
                date: "2025-04-12",
                purpose: "Educational materials"
            }
        ],

        expenditures: [
            {
                id: 1,
                department: "Health",
                category: "Equipment",
                amount: 450000,
                date: "2026-05-12",
                reference: "EXP-1001",
                budgetId: 1,
                description: "Medical equipment purchase",
                documentName: ""
            },
            {
                id: 2,
                department: "Health",
                category: "Supplies",
                amount: 250000,
                date: "2026-06-10",
                reference: "EXP-1002",
                budgetId: 1,
                description: "Medical supplies",
                documentName: ""
            },
            {
                id: 3,
                department: "Education",
                category: "Infrastructure",
                amount: 300000,
                date: "2026-05-20",
                reference: "EXP-1003",
                budgetId: 2,
                description: "Classroom repairs",
                documentName: ""
            },
            {
                id: 4,
                department: "Public Works",
                category: "Infrastructure",
                amount: 1650000,
                date: "2026-06-15",
                reference: "EXP-1004",
                budgetId: 3,
                description: "Road repair project",
                documentName: ""
            },
            {
                id: 5,
                department: "Agriculture",
                category: "Supplies",
                amount: 150000,
                date: "2026-05-25",
                reference: "EXP-1005",
                budgetId: 4,
                description: "Agricultural supplies",
                documentName: ""
            },
            {
                id: 6,
                department: "Health",
                category: "Maintenance",
                amount: 100000,
                date: "2025-06-12",
                reference: "EXP-1006",
                budgetId: 6,
                description: "Previous year maintenance",
                documentName: ""
            }
        ],

        thresholds: {
            underUtilization: 40,
            elapsedTime: 50,
            spike: 30,
            overspending: 100
        },

        reviewedAlerts: [],
        auditLog: []
    };

    function loadData() {
        try {
            const savedData = localStorage.getItem(STORAGE_KEY);

            if (savedData) {
                const parsedData = JSON.parse(savedData);

                if (
                    parsedData &&
                    Array.isArray(parsedData.budgets) &&
                    Array.isArray(parsedData.expenditures)
                ) {
                    return {
                        ...initialData,
                        ...parsedData,
                        departments: parsedData.departments || initialData.departments,
                        thresholds: {
                            ...initialData.thresholds,
                            ...(parsedData.thresholds || {})
                        }
                    };
                }
            }
        } catch (error) {
            console.error("Could not load saved data:", error);
        }

        return JSON.parse(JSON.stringify(initialData));
    }

    function saveData(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error("Could not save data:", error);
            alert("Data could not be saved. Check your browser storage.");
            return false;
        }
    }

    window.BudgetWatchStore = {
        load: loadData,
        save: saveData
    };
})();
