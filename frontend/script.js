var form = document.getElementById("segment-form");
var submitBtn = document.getElementById("submit-btn");
var btnText = document.getElementById("btn-text");
var btnLoader = document.getElementById("btn-loader");
var errorBanner = document.getElementById("error-banner");
var rows = document.querySelectorAll(".roster-row");
var slots = document.querySelectorAll(".profile-slot");

function showError(message) {
    errorBanner.textContent = message;
    errorBanner.classList.add("visible");
}

function hideError() {
    errorBanner.textContent = "";
    errorBanner.classList.remove("visible");
}

function setLoading(loading) {
    submitBtn.disabled = loading;
    btnText.textContent = loading ? "Processing..." : "Submit Entry";
    btnLoader.classList.toggle("visible", loading);
}

function clearDrawer() {
    rows.forEach(function(row) {
        row.classList.remove("active", "receded");
    });
    slots.forEach(function(slot) {
        slot.innerHTML = "";
    });
}

function applyDrawerState(clusterId, payload) {
    clearDrawer();
    
    var activeRow = document.querySelector('.roster-row[data-cluster-id="' + clusterId + '"]');
    if (!activeRow) {
        return;
    }
    
    rows.forEach(function(row) {
        if (row !== activeRow) {
            row.classList.add("receded");
        }
    });
    
    activeRow.classList.add("active");
    
    var activeSlot = document.getElementById("slot-" + clusterId);
    if (activeSlot) {
        activeSlot.innerHTML = 
            '<span class="slot-title">Matched Entry</span>' +
            '<div class="slot-metrics">' +
                '<div class="slot-metric">Age: <span>' + payload.age + '</span></div>' +
                '<div class="slot-metric">Income: <span>$' + payload.annual_income + 'k</span></div>' +
                '<div class="slot-metric">Spend: <span>' + payload.spending_score + '/100</span></div>' +
            '</div>';
    }

    var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    activeRow.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "nearest"
    });
}

if (form) {
    form.addEventListener("submit", function(e) {
        e.preventDefault();
        hideError();
        setLoading(true);

        var payload = {
            age: parseInt(document.getElementById("age").value, 10),
            annual_income: parseFloat(document.getElementById("annual_income").value),
            spending_score: parseInt(document.getElementById("spending_score").value, 10)
        };

        if (isNaN(payload.age) || isNaN(payload.annual_income) || isNaN(payload.spending_score)) {
            showError("All entry fields must be filled with valid numbers.");
            setLoading(false);
            return;
        }

        var controller = new AbortController();
        var timeoutId = setTimeout(function() { controller.abort(); }, 100000);

        fetch("/predict-segment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal
        })
        .then(function(response) {
            clearTimeout(timeoutId);
            if (!response.ok) {
                return response.json().catch(function() { return {}; }).then(function(err) {
                    throw new Error(err.detail || "Server responded with status " + response.status);
                });
            }
            return response.json();
        })
        .then(function(data) {
            applyDrawerState(data.cluster_id, payload);
        })
        .catch(function(error) {
            clearTimeout(timeoutId);
            clearDrawer();
            if (error.name === "AbortError") {
                showError("Server response timeout. Please try again.");
            } else {
                showError(error.message || "An unexpected error occurred. Please try again.");
            }
        })
        .finally(function() {
            setLoading(false);
        });
    });
}
