(function () {
    const form = document.getElementById("segment-form");
    const submitBtn = document.getElementById("submit-btn");
    const btnText = document.getElementById("btn-text");
    const btnLoader = document.getElementById("btn-loader");
    const errorBanner = document.getElementById("error-banner");
    
    const ageInput = document.getElementById("age");
    const incomeInput = document.getElementById("annual_income");
    const spendInput = document.getElementById("spending_score");
    
    const ageVal = document.getElementById("age-val");
    const incomeVal = document.getElementById("annual_income-val");
    const spendVal = document.getElementById("spending_score-val");
    
    const cards = document.querySelectorAll(".roster-card");

    let currentAbortController = null;

    function showError(message) {
        errorBanner.textContent = message;
        errorBanner.classList.add("visible");
    }

    function hideError() {
        errorBanner.textContent = "";
        errorBanner.classList.remove("visible");
    }

    function setLoading(loading) {
        if (submitBtn) submitBtn.disabled = loading;
        if (btnText) btnText.textContent = loading ? "Processing..." : "Submit Entry";
        if (btnLoader) btnLoader.classList.toggle("visible", loading);
    }

    function clearRosterStates() {
        cards.forEach(card => {
            card.classList.remove("active", "receded");
            const slot = card.querySelector(".profile-match-slot");
            if (slot) {
                slot.querySelector(".match-age").textContent = "—";
                slot.querySelector(".match-income").textContent = "—";
                slot.querySelector(".match-spend").textContent = "—";
            }
        });
    }

    function highlightMatchedSegment(clusterId, inputs) {
        clearRosterStates();
        
        const matchedCard = document.querySelector(`.roster-card[data-cluster="${clusterId}"]`);
        if (!matchedCard) return;

        cards.forEach(card => {
            if (card !== matchedCard) {
                card.classList.add("receded");
            }
        });

        matchedCard.classList.add("active");

        const slot = matchedCard.querySelector(".profile-match-slot");
        if (slot) {
            slot.querySelector(".match-age").textContent = inputs.age;
            slot.querySelector(".match-income").textContent = inputs.annual_income;
            slot.querySelector(".match-spend").textContent = inputs.spending_score;
        }

        const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        matchedCard.scrollIntoView({
            behavior: prefersReducedMotion ? "auto" : "smooth",
            block: "nearest"
        });
    }

    function validateInputs(inputs) {
        if (isNaN(inputs.age) || isNaN(inputs.annual_income) || isNaN(inputs.spending_score)) {
            return "All fields must contain valid numbers.";
        }
        if (inputs.age < 18) {
            return "Age must be at least 18 years.";
        }
        if (inputs.annual_income < 5) {
            return "Annual income must be at least 5k$.";
        }
        if (inputs.spending_score < 1) {
            return "Spending score must be at least 1.";
        }
        return null;
    }

    async function predictSegment(inputs) {
        if (currentAbortController) {
            currentAbortController.abort();
        }

        currentAbortController = new AbortController();
        setLoading(true);
        hideError();

        try {
            const response = await fetch("/predict-segment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(inputs),
                signal: currentAbortController.signal
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.detail || `Server error (${response.status})`);
            }

            const data = await response.json();
            highlightMatchedSegment(data.cluster_id, inputs);
        } catch (error) {
            if (error.name === "AbortError") {
                return;
            }
            clearRosterStates();
            showError(error.message || "An unexpected error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    function getInputs() {
        return {
            age: parseInt(ageInput.value, 10),
            annual_income: parseFloat(incomeInput.value),
            spending_score: parseInt(spendInput.value, 10)
        };
    }

    function bindSlider(slider, displayElement) {
        if (!slider || !displayElement) return;

        const updateDisplay = () => {
            displayElement.textContent = slider.value;
        };

        slider.addEventListener("input", updateDisplay);
        updateDisplay();
    }

    if (ageInput && incomeInput && spendInput) {
        bindSlider(ageInput, ageVal);
        bindSlider(incomeInput, incomeVal);
        bindSlider(spendInput, spendVal);
    }

    if (form) {
        form.addEventListener("submit", function (e) {
            e.preventDefault();
            const inputs = getInputs();

            const error = validateInputs(inputs);
            if (error) {
                showError(error);
                clearRosterStates();
                return;
            }

            predictSegment(inputs);
        });
    }

})();
