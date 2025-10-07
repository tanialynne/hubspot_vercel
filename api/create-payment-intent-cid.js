<!-- Pricing Packages Module -->
<div class="heroic-pricing-section">
  <div class="heroic-pricing-container">
    <div class="heroic-pricing-grid">
      {% for package in module.pricing_packages %}
      <div
        class="heroic-pricing-card {% if package.is_popular %}popular{% endif %}"
      >
        {% if package.is_popular %}
        <div class="heroic-popular-flag">
          <span
            >{% if package.popular_text and package.popular_text != "" %}{{
            package.popular_text }}{% else %}Most Popular{% endif %}</span
          >
        </div>
        {% endif %}

        <div class="heroic-pricing-card-content">
          <h3 class="heroic-pricing-title">{{ package.title }}</h3>

          <div class="heroic-pricing-buttons">
            {% if package.monthly_price %}
            <button
              class="heroic-pricing-btn monthly open-checkout"
              data-price="{{ package.monthly_price }}"
              data-price-id="{{ package.monthly_price_id }}"
              data-product-id="{{ package.product_id }}"
              data-label="{{ package.title }} - Monthly"
              data-product-type="{{ package.product_type }}"
              data-period="monthly"
              data-success-url="{{ package.success_redirect_url.href }}"
              data-hubspot-form="{{ package.hubspot_form_guid }}"
              data-ac-tags="{% for tag in package.ac_tag_ids %}{{ tag.tag_text }}{% if not loop.last %},{% endif %}{% endfor %}"
            >
              ${{ package.monthly_price }}/mo
            </button>
            {% endif %} {% if package.annual_price %}
            <button
              class="heroic-pricing-btn annual open-checkout"
              data-price="{{ package.annual_price }}"
              data-price-id="{{ package.annual_price_id }}"
              data-product-id="{{ package.product_id }}"
              data-label="{{ package.title }} - Annual"
              data-product-type="{{ package.product_type }}"
              data-period="annual"
              data-success-url="{{ package.success_redirect_url.href }}"
              data-hubspot-form="{{ package.hubspot_form_guid }}"
              data-ac-tags="{% for tag in package.ac_tag_ids %}{{ tag.tag_text }}{% if not loop.last %},{% endif %}{% endfor %}"
            >
              ${{ package.annual_price }}/yr
            </button>
            {% endif %} {% if package.payment_plan_price %}
            <button
              class="heroic-pricing-btn payment-plan open-checkout"
              data-price="{{ package.payment_plan_price }}"
              data-price-id="{{ package.payment_plan_price_id }}"
              data-product-id="{{ package.product_id }}"
              data-label="{{ package.title }} - {{ package.payment_plan_installments|default(12) }} Payments"
              data-product-type="{{ package.product_type }}"
              data-period="payment_plan"
              data-installments="{{ package.payment_plan_installments|default(12) }}"
              data-success-url="{{ package.success_redirect_url.href }}"
              data-hubspot-form="{{ package.hubspot_form_guid }}"
              data-ac-tags="{% for tag in package.ac_tag_ids %}{{ tag.tag_text }}{% if not loop.last %},{% endif %}{% endfor %}"
            >
              ${{ package.payment_plan_price }}/mo × {{ package.payment_plan_installments|default(12) }}
            </button>
            {% endif %} {% if package.onetime_price %}
            <button
              class="heroic-pricing-btn onetime open-checkout"
              data-price="{{ package.onetime_price }}"
              data-price-id="{{ package.onetime_price_id }}"
              data-product-id="{{ package.product_id }}"
              data-label="{{ package.title }} - One-Time"
              data-product-type="{{ package.product_type }}"
              data-period="onetime"
              data-success-url="{{ package.success_redirect_url.href }}"
              data-hubspot-form="{{ package.hubspot_form_guid }}"
              data-ac-tags="{% for tag in package.ac_tag_ids %}{{ tag.tag_text }}{% if not loop.last %},{% endif %}{% endfor %}"
            >
              ${{ package.onetime_price }}
            </button>
            {% endif %}
          </div>

          {% if package.savings_text %}
          <p class="heroic-pricing-savings">{{ package.savings_text }}</p>
          {% endif %} {% if package.features %}
          <ul class="heroic-pricing-features">
            {% for feature in package.features %}
            <li>{{ feature.feature_text }}</li>
            {% endfor %}
          </ul>
          {% endif %}
        </div>
      </div>
      {% endfor %}
    </div>
  </div>
</div>

<!-- Stripe Checkout Modal -->
<div id="checkout-modal" style="display: none">
  <div class="modal-overlay"></div>
  <div class="modal-content">
    <span class="close-modal">&times;</span>
    <div id="checkout-form">
      <div class="form-header">
        <h5 id="form-heading">Complete Your Purchase</h5>
        <p id="display-price"></p>
      </div>

      <form id="payment-form">
        <!-- Customer Info Grid -->
        <div class="form-grid">
          <input
            type="text"
            id="first-name"
            placeholder="First Name"
            required
          />
          <input type="text" id="last-name" placeholder="Last Name" required />
          <input type="email" id="email" placeholder="Email" required />
          <input type="tel" id="phone" placeholder="Phone" required />
        </div>

        <div class="payment-field">
          <!-- Stripe Elements Card Field -->
          <div id="card-element"></div>
        </div>

        <!-- Security Badge -->
        <div class="security-badge">
          <i class="fas fa-shield-alt"></i>
          <span
            >Your payment information is processed securely via Stripe. We do
            not store credit card details.</span
          >
        </div>

        <!-- Submit Button -->
        <button
          type="submit"
          class="button button-secondary button-animation form-trigger"
        >
          <i class="fas fa-lock"></i>
          <span id="button-text">Complete Secure Purchase</span>
        </button>
        <div id="hidden-hs-form" style="display: none"></div>
        <div id="status-msg" style="margin-top: 10px; color: gray"></div>
        <div id="payment-overlay">
          <span class="loader"></span><br />Processing...
        </div>
      </form>
    </div>
  </div>
</div>

<style>
  .heroic-pricing-section {
    width: 100%;
    padding: 0;
    background-color: transparent;
    color: #fff;
  }

  /* Light mode support */
  @media (prefers-color-scheme: light) {
    .heroic-pricing-section {
      background-color: transparent;
      color: #1c1c1c;
    }
  }

  .heroic-pricing-container {
    margin: 0 auto;
    padding: 0 24px;
    max-width: 1400px;
  }

  .heroic-pricing-grid {
    display: flex;
    gap: 32px;
    justify-content: center;
    align-items: flex-start;
    flex-wrap: wrap;
    margin-top: 47px;
  }

  .heroic-pricing-card {
    position: relative;
    width: 409px;
    max-width: 100%;
    background: transparent;
    border-radius: 31px;
    border: 1px solid transparent;
    overflow: visible;
  }

  /* Ensure 3 cards fit at 1440px viewport */
  @media screen and (max-width: 1440px) {
    .heroic-pricing-card {
      width: calc(
        (100vw - 48px - 64px) / 3
      ); /* 3 cards with gaps and padding */
      max-width: 409px;
      min-width: 320px;
    }

    .heroic-pricing-container {
      max-width: 1440px;
    }
  }

  .heroic-pricing-card.popular {
    border: 2px solid rgba(255, 255, 255, 0.5);
    background: transparent;
    border-radius: 32px;
  }

  /* Light mode pricing cards */
  @media (prefers-color-scheme: light) {
    .heroic-pricing-card {
      background: #fff;
      border: 1px solid transparent;
    }

    .heroic-pricing-card.popular {
      border: 2px solid #1c1c1c;
      background: #f5f5f5;
    }
  }

  .heroic-popular-flag {
    position: absolute;
    top: -47px;
    left: 50%;
    transform: translateX(-50%);
    width: 260px;
    height: 47px;
    background: #fff;
    border-radius: 16px 16px 0 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
  }

  .heroic-popular-flag span {
    color: #1c1c1c;
    text-align: center;
    font-size: 20px;
    font-style: normal;
    font-weight: 400;
    line-height: normal;
  }

  /* Light mode popular flag */
  @media (prefers-color-scheme: light) {
    .heroic-popular-flag {
      background: #1c1c1c;
    }

    .heroic-popular-flag span {
      color: #fff;
    }
  }

  .heroic-pricing-card-content {
    padding: 48px 32px 32px;
  }

  .heroic-pricing-title {
    color: #fff;
    text-align: center;
    font-family: National, sans-serif;
    font-size: 48px;
    font-style: normal;
    font-weight: 800;
    line-height: 80px;
    text-transform: uppercase;
    margin: 0 0 24px;
    position: relative;
    padding-bottom: 16px;
  }

  .heroic-pricing-title::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 100%;
    height: 2px;
    background: #eb0505;
  }

  /* Light mode title */
  @media (prefers-color-scheme: light) {
    .heroic-pricing-title {
      color: #1c1c1c;
    }
  }

  .heroic-pricing-buttons {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
  }

  .heroic-pricing-btn {
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    background: rgba(255, 255, 255, 0.1);
    box-shadow: 0.822px 0.822px 0.822px 0 rgba(255, 255, 255, 0.25) inset;
    display: flex;
    height: 42px;
    padding: 18px;
    justify-content: center;
    align-items: center;
    flex: 1 0 0;
    color: #fff;
    text-align: center;
    font-size: 20px;
    font-style: normal;
    font-weight: 400;
    line-height: normal;
    text-decoration: none;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .heroic-pricing-btn.annual,
  .heroic-pricing-btn.onetime,
  .heroic-pricing-btn.active {
    border: 1px solid rgba(255, 255, 255, 0);
    background: #ed0505;
    box-shadow: 0.822px 0.822px 0.822px 0 rgba(255, 255, 255, 0.25) inset;
    color: #fff;
  }

  /* Light mode pricing buttons */
  @media (prefers-color-scheme: light) {
    .heroic-pricing-btn {
      border: 1px solid #1c1c1c;
      background: rgba(164, 164, 164, 0.4);
      color: #1c1c1c;
    }

    .heroic-pricing-btn.annual,
    .heroic-pricing-btn.onetime,
    .heroic-pricing-btn.active {
      border: 1px solid rgba(255, 255, 255, 0);
      background: #ed0505;
      color: #fff;
    }
  }

  .heroic-pricing-btn:hover {
    transform: translateY(-1px);
    box-shadow:
      0 2px 4px rgba(0, 0, 0, 0.1),
      0.822px 0.822px 0.822px 0 rgba(255, 255, 255, 0.25) inset;
  }

  /* Ensure monthly button text stays correct color on hover */
  .heroic-pricing-btn.monthly:hover {
    color: #fff !important;
  }

  /* Light mode monthly button hover */
  @media (prefers-color-scheme: light) {
    .heroic-pricing-btn.monthly:hover {
      color: #1c1c1c !important;
    }
  }

  .heroic-pricing-savings {
    color: rgba(255, 255, 255, 0.8);
    text-align: center;
    font-size: 16px !important;
    font-style: normal;
    font-weight: 400;
    line-height: 27.696px;
    margin: 0 0 32px;
  }

  /* Light mode savings text */
  @media (prefers-color-scheme: light) {
    .heroic-pricing-savings {
      color: #1c1c1c;
    }
  }

  .heroic-pricing-features {
    list-style: none;
    padding: 0;
    margin: 0 0 32px;
  }

  .heroic-pricing-features li {
    color: rgba(255, 255, 255, 0.9);
    font-size: 16px;
    font-style: normal;
    font-weight: 400;
    line-height: 160%;
    margin-bottom: 8px;
    position: relative;
    padding-left: 20px;
  }

  .heroic-pricing-features li::before {
    content: "•";
    position: absolute;
    left: 0;
    color: rgba(255, 255, 255, 0.9);
    font-weight: bold;
  }

  /* Light mode features */
  @media (prefers-color-scheme: light) {
    .heroic-pricing-features li {
      color: #1c1c1c;
    }

    .heroic-pricing-features li::before {
      color: #1c1c1c;
    }
  }

  /* Responsive design */
  @media screen and (max-width: 1024px) {
    .heroic-pricing-container {
      padding: 0 32px;
    }

    .heroic-pricing-grid {
      gap: 24px;
    }

    .heroic-pricing-card {
      width: 360px;
    }

    .heroic-pricing-title {
      font-size: 36px;
      line-height: 60px;
    }
  }

  @media screen and (max-width: 768px) {
    .heroic-pricing-section {
      padding: 48px 0;
    }

    .heroic-pricing-container {
      padding: 0 16px;
    }

    .heroic-pricing-grid {
      flex-direction: column;
      align-items: center;
      gap: 32px;
    }

    .heroic-pricing-card {
      width: 100%;
      max-width: 400px;
    }

    .heroic-pricing-card-content {
      padding: 32px 24px 24px;
    }

    .heroic-pricing-card.popular {
      margin-top: 30px;
    }

    .heroic-pricing-title {
      font-size: 28px;
      line-height: 40px;
      margin-bottom: 20px;
    }

    .heroic-popular-flag span {
      font-size: 16px;
    }

    .heroic-pricing-btn {
      font-size: 16px;
      height: 38px;
      padding: 12px;
    }
  }

  @media screen and (max-width: 480px) {
    .heroic-pricing-title {
      font-size: 24px;
      line-height: 32px;
    }

    .heroic-pricing-features li,
    .heroic-pricing-savings {
      font-size: 14px;
    }
  }

  /* Modal Styles */
  #payment-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.6);
    color: white;
    display: none;
    justify-content: center;
    align-items: center;
    font-size: 1.5rem;
    z-index: 10000;
  }

  #payment-form label {
    margin-bottom: 0.5em;
  }

  .loader {
    width: 48px;
    height: 48px;
    border: 3px solid #fff;
    border-radius: 50%;
    display: inline-block;
    position: relative;
    box-sizing: border-box;
    animation: rotation 1s linear infinite;
  }

  .loader::after {
    content: "";
    box-sizing: border-box;
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 3px solid;
    border-color: #ff3d00 transparent;
  }

  @keyframes rotation {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  #card-element {
    background-color: #fff;
    border: 1px solid #d1d6dc;
    border-radius: 8px;
    color: #0e0303;
    display: block;
    font-size: 0.9375rem;
    padding: 0.75rem;
    width: 100%;
    transition: border-color 0.2s ease;
  }

  #card-element:focus-within {
    border-color: #9ca3af;
  }

  #card-element .StripeElement {
    padding: 0;
  }

  #checkout-form {
    padding: 0;
    border: none;
  }

  #checkout-form h5 {
    text-transform: uppercase;
    margin-bottom: 1rem;
  }

  #checkout-form button {
    width: 100%;
  }

  #checkout-modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10001;
  }

  .modal-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.6);
    z-index: 0;
  }

  .modal-content {
    position: relative;
    background: white;
    padding: 2rem;
    border-radius: 12px;
    max-width: 650px;
    width: 90%;
    z-index: 1;
    overflow-y: auto;
    max-height: 90vh;
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.1),
      0 10px 10px -5px rgba(0, 0, 0, 0.04);
  }

  /* Mobile adjustments for 72px header */
  @media screen and (max-width: 768px) {
    .modal-content {
      width: 95%;
      padding: 1.5rem;
      max-height: calc(100vh - 92px);
      margin-top: 72px;
    }

    #checkout-modal {
      align-items: flex-start;
      padding-top: 10px;
    }
  }

  .close-modal {
    position: absolute;
    top: 8px;
    right: 12px;
    font-size: 24px;
    cursor: pointer;
    color: #1c1c1c;
  }

  body.modal-open {
    overflow: hidden;
    height: 100vh;
  }

  /* Form header with title and price inline */
  .form-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 2px solid #e5e7eb;
  }

  #checkout-form h5 {
    margin: 0;
    font-size: 1.25rem;
  }

  #display-price {
    font-size: 1.5rem;
    font-weight: bold;
    margin: 0;
    color: #1c1c1c;
  }

  @media screen and (max-width: 600px) {
    .form-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }

    #display-price {
      font-size: 1.25rem;
    }
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }

  @media screen and (max-width: 600px) {
    .form-grid {
      grid-template-columns: 1fr;
    }
  }

  #checkout-form input[type="text"],
  #checkout-form input[type="email"],
  #checkout-form input[type="tel"] {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #d1d6dc;
    border-radius: 8px;
    font-size: 0.9375rem;
    transition: border-color 0.2s ease;
  }

  #checkout-form input[type="text"]::placeholder,
  #checkout-form input[type="email"]::placeholder,
  #checkout-form input[type="tel"]::placeholder {
    color: #6b7280;
    opacity: 1;
  }

  #checkout-form input[type="text"]:focus,
  #checkout-form input[type="email"]:focus,
  #checkout-form input[type="tel"]:focus {
    outline: none;
    border-color: #6b7280;
  }

  .payment-field {
    margin-bottom: 0.75rem;
  }

  /* Security Badge */
  .security-badge {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    margin-bottom: 1rem;
  }

  .security-badge i {
    flex-shrink: 0;
    font-size: 1.25rem;
    color: #6b7280;
  }

  .security-badge span {
    color: #6b7280;
    font-size: 0.8125rem;
    line-height: 1.5;
  }

  /* Enhanced Submit Button */
  #checkout-form button[type="submit"] {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.625rem;
    font-weight: 600;
    font-size: 1rem;
    padding: 0.875rem 1.5rem;
    transition: all 0.2s ease;
  }

  #checkout-form button[type="submit"] i {
    font-size: 1.125rem;
  }

  #checkout-form button[type="submit"]:hover {
    transform: translateY(-1px);
    box-shadow:
      0 4px 6px -1px rgba(0, 0, 0, 0.1),
      0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }

  /* Mobile security badge */
  @media screen and (max-width: 600px) {
    .security-badge {
      padding: 0.75rem;
    }

    .security-badge span {
      font-size: 0.75rem;
    }
  }
</style>

<script src="https://js.stripe.com/v3/"></script>
<script>
  // Stripe configuration
  let stripePublicKey;
  if ("{{ module.stripe_mode }}" === "live") {
    stripePublicKey = "pk_live_jm6K37TV9w6PZbaY6Y6vhkUk";
  } else {
    stripePublicKey = "pk_test_VibwSU7sJXCQVztNJCy2qS5N";
  }

  const stripe = Stripe(stripePublicKey);

  // We'll initialize checkout after we get the client secret
  let checkout = null;

  // Store selected package data
  let selectedPackageData = {};

  document.addEventListener("DOMContentLoaded", function () {
    // Modal elements
    const modal = document.getElementById("checkout-modal");
    const closeBtn = modal.querySelector(".close-modal");
    const openButtons = document.querySelectorAll(".open-checkout");

    // Open modal and populate data
    openButtons.forEach((btn) => {
      btn.addEventListener("click", async function (e) {
        e.preventDefault();

        const overlay = document.getElementById("payment-overlay");
        const status = document.getElementById("status-msg");

        // Store package data
        // Remove commas from price before parsing (e.g., "1,499" -> "1499")
        const priceString = this.dataset.price.replace(/,/g, "");
        const priceNumber = parseFloat(priceString);

        selectedPackageData = {
          price: priceNumber,
          priceId: this.dataset.priceId,
          productId: this.dataset.productId,
          label: this.dataset.label,
          productType: this.dataset.productType,
          period: this.dataset.period,
          installments: this.dataset.installments || null,
          successUrl: this.dataset.successUrl,
          hubspotForm: this.dataset.hubspotForm,
          acTags: this.dataset.acTags,
        };

        // Update modal content - format price with commas for display
        const formattedPrice =
          selectedPackageData.price.toLocaleString("en-US");
        let priceDisplay = `$${formattedPrice}`;
        if (selectedPackageData.period === "monthly") {
          priceDisplay += "/mo";
        } else if (selectedPackageData.period === "annual") {
          priceDisplay += "/yr";
        }
        // For onetime, no suffix is added

        document.getElementById("display-price").textContent = priceDisplay;
        document.getElementById("form-heading").textContent =
          selectedPackageData.label;

        // Update button text with price
        document.getElementById("button-text").textContent =
          `Complete Purchase ${priceDisplay}`;

        // Show modal
        modal.style.display = "flex";
        document.body.classList.add("modal-open");

        // Fire custom event for tracking
        const card = this.closest(".heroic-pricing-card");
        const cardTitle = card?.querySelector(
          ".heroic-pricing-title"
        )?.textContent;
        document.dispatchEvent(
          new CustomEvent("heroic:pricing-button-clicked", {
            detail: {
              cardTitle: cardTitle,
              period: selectedPackageData.period,
              price: selectedPackageData.price,
              priceId: selectedPackageData.priceId,
              productId: selectedPackageData.productId,
            },
          })
        );
      });
    });

    // Close modal
    closeBtn.addEventListener("click", () => {
      modal.style.display = "none";
      document.body.classList.remove("modal-open");
    });

    // Close when clicking outside modal content
    modal.addEventListener("click", (e) => {
      if (e.target === modal || e.target.classList.contains("modal-overlay")) {
        modal.style.display = "none";
        document.body.classList.remove("modal-open");
      }
    });

    // Handle form submission - just validate, don't submit yet
    // The checkout form will be initialized when modal opens
    let checkoutInitialized = false;
    let currentSessionData = null;

    document.getElementById("payment-form").addEventListener("submit", async (e) => {
      e.preventDefault();

      const overlay = document.getElementById("payment-overlay");
      const status = document.getElementById("status-msg");

      // Validate required fields
      const firstName = document.getElementById("first-name").value.trim();
      const lastName = document.getElementById("last-name").value.trim();
      const email = document.getElementById("email").value.trim();
      const phone = document.getElementById("phone").value.trim();

      if (!firstName || !lastName || !email) {
        status.textContent = "Please fill in all required fields";
        return;
      }

      // Store customer data for later use in onComplete callback
      currentSessionData = {
        firstName,
        lastName,
        email,
        phone,
      };

      overlay.style.display = "flex";
      status.textContent = "Processing...";

      const customerData = {
        firstName,
        lastName,
        email,
        phone,
        basePrice: Math.round(selectedPackageData.price * 100),
        baseLabel: selectedPackageData.label,
        basePriceId: selectedPackageData.priceId,
        baseProductId: selectedPackageData.productId,
        productType: selectedPackageData.productType,
        period: selectedPackageData.period,
        installments: selectedPackageData.installments,
        hubspotFormGuid: selectedPackageData.hubspotForm,
        acTags: selectedPackageData.acTags,
        successUrl: selectedPackageData.successUrl,
        mode: "{{ module.stripe_mode }}",
      };

      console.log("🧾 Creating checkout session:", customerData);

      try {
        // Create Checkout Session with custom UI
        const res = await fetch(
          "https://hubspot-vercel-chi.vercel.app/api/create-payment-intent-cid",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(customerData),
          }
        );

        if (!res.ok) {
          const errorData = await res.json();
          console.error("❌ API Error:", errorData);
          overlay.style.display = "none";
          status.textContent =
            "Payment failed: " +
            (errorData.details || errorData.error || "Unknown error");
          return;
        }

        const data = await res.json();
        const { clientSecret, checkoutSessionId, customerId } = data;

        console.log("✅ Received checkout session:", checkoutSessionId);

        if (!clientSecret) {
          console.error("❌ No clientSecret received");
          overlay.style.display = "none";
          status.textContent = "Payment failed: No client secret received";
          return;
        }

        // Initialize Checkout with custom UI (using Elements)
        checkout = await stripe.initCheckout({
          clientSecret: clientSecret,
          elementsOptions: {
            appearance: {
              theme: 'stripe',
            }
          }
        });

        console.log("✅ Checkout initialized with custom UI");

        // Create and mount payment element in the card-element div
        const paymentElement = checkout.createPaymentElement();
        paymentElement.mount("#card-element");

        // Update email for the checkout
        await checkout.updateEmail(customerData.email);

        overlay.style.display = "none";

        // Change button text and behavior
        const submitButton = document.querySelector("#payment-form button[type='submit']");
        submitButton.textContent = "Complete Payment";

        // Remove old submit listener and add new one for payment confirmation
        const newSubmitHandler = async (e) => {
          e.preventDefault();
          e.stopPropagation();

          overlay.style.display = "flex";
          status.textContent = "Processing payment...";

          try {
            // Confirm the checkout
            const { error } = await checkout.confirm();

            if (error) {
              console.error("💥 Payment error:", error);
              overlay.style.display = "none";
              status.textContent = "Payment failed: " + error.message;
              return;
            }

            // Payment successful!
            console.log("✅ Payment completed via Checkout Session");
            status.textContent = "Processing order...";

            // Submit to HubSpot
            await submitHubspotForm(
              customerData,
              checkoutSessionId,
              selectedPackageData.hubspotForm
            );

            // Apply ActiveCampaign tags
            const baseTags = selectedPackageData.acTags
              ? selectedPackageData.acTags.split(",").map((t) => t.trim()).filter((t) => t)
              : [];

            if (customerData.email && baseTags.length > 0) {
              console.log("Applying AC tags:", baseTags);
              await fetch("https://hubspot-vercel-chi.vercel.app/api/tag-with-text", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  email: customerData.email,
                  tags: baseTags,
                }),
              });
              console.log("✅ AC tags applied");
            }

            // Redirect to success page
            const firstName = encodeURIComponent(customerData.firstName);
            const productLabel = encodeURIComponent(selectedPackageData.label);
            const productType = encodeURIComponent(selectedPackageData.productType || "");
            window.location.href = `${customerData.successUrl}?session_id=${checkoutSessionId}&cid=${customerId}&name=${firstName}&product=${productLabel}&type=${productType}`;

          } catch (err) {
            console.error("💥 Error confirming payment:", err);
            overlay.style.display = "none";
            status.textContent = "Something went wrong. Please try again.";
          }
        };

        // Replace the form submit handler
        const form = document.getElementById("payment-form");
        form.removeEventListener("submit", arguments.callee);
        form.addEventListener("submit", newSubmitHandler);

      } catch (err) {
        console.error("💥 Error processing payment:", err);
        overlay.style.display = "none";
        status.textContent = "Something went wrong. Please try again.";
      }
    });
  });

  // Submit HubSpot form
  const submitHubspotForm = async (
    customerData,
    paymentIntentId,
    hubspotFormGuid
  ) => {
    const formData = new FormData();
    formData.append("0-1/firstname", customerData.firstName);
    formData.append("0-1/lastname", customerData.lastName);
    formData.append("0-1/email", customerData.email);
    formData.append("0-1/phone", customerData.phone);
    formData.append("0-1/website", window.location.href);

    const totalAmount = customerData.basePrice / 100;
    const productName = customerData.baseLabel;

    formData.append("0-1/purchase_amount", totalAmount.toFixed(2));
    formData.append("0-1/product_name", productName);
    formData.append("0-1/payment_intent_id", paymentIntentId);

    formData.append(
      "0-1/purchase_details",
      JSON.stringify({
        paymentIntentId,
        totalAmount: totalAmount.toFixed(2),
        productName,
        basePrice: (customerData.basePrice / 100).toFixed(2),
        baseLabel: customerData.baseLabel,
        basePriceId: customerData.basePriceId,
        baseProductId: customerData.baseProductId,
      })
    );

    const url = `https://api.hsforms.com/submissions/v3/integration/submit/45764384/${hubspotFormGuid}`;

    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: Array.from(formData.entries()).map(([name, value]) => ({
          name,
          value,
        })),
      }),
    });
  };
</script>
