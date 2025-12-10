### **My Business Roadmap: The Payment Facilitator Platform**

I have pivoted to a much more viable and scalable idea: a **"Payment Facilitator" platform**. This approach solves a genuine pain point—payment access for Nigerians—rather than exploiting a risky pricing loophole.

The core of my business will be integrating a stable **Card Issuing API** that allows me to generate virtual cards for my users programmatically.

Here is my technical and operational blueprint for building this in Nigeria right now.

---

### **1. The Core Infrastructure: APIs I Will Use**

For my specific use case (recurring YouTube subscriptions), I need an API that supports **reloadable** cards, not just disposable ones.

#### **Top Recommendation: Bridgecard**
Bridgecard is currently the most developer-friendly option for my needs because they explicitly support **Naira (NGN) cards for international platforms**.

* **Why I’m choosing them:** They offer a "Naira Card" that works on global platforms (like Netflix, Spotify, and likely YouTube) but charges the user’s wallet in Naira. This saves me and my customers from expensive Dollar ($) exchange rates.
* **Currency:** Supports NGN & USD.
* **Key Feature:** I can fund the card via a virtual bank account transfer, which fits my intended workflow perfectly.

#### **Alternative 1: Maplerad**
I will keep Maplerad as a backup if I specifically need **USD** cards.

* **Why them:** They have a very stable API for generating virtual Visa/Mastercards.
* **Currency:** Primarily USD (Virtual).
* **Cost:** Usually ~$2 card creation fee.
* **Best use case:** If YouTube Nigeria rejects my NGN virtual cards, I can fall back to Maplerad USD cards to pay for the subscription in Dollars (even though this increases the cost for the user).

#### **Alternative 2: Flutterwave (FaaS)**
The "Big Player" option.

* **Why them:** They have the most robust infrastructure, but their compliance requirements (KYC) are much stricter.
* **Currency:** NGN & USD.
* **Note:** I will likely need to register as a formal business (CAC) and pass strict compliance checks before accessing their Card Issuing API live keys.

---

### **2. My Business Logic (How I Make Money)**

I have two potential paths. **Path A** is my priority as it is significantly more profitable.

#### **Path A: The Local Fix (High Margin)**
* **The Problem:** The user wants to pay the YouTube Nigeria price (~₦1,100/mo), but their local GTB/Zenith card fails.
* **My Solution:** I issue them a **Virtual NGN Card** (via Bridgecard/Bloc).
* **The Math:**
    * YouTube Cost: ₦1,100
    * Card Fee: ₦100 (approx)
    * **I Charge:** ₦2,000/month.
    * **User Benefit:** They pay a flat Naira fee and it *just works*. No black market dollar rates.

#### **Path B: The Dollar Fix (Reliability)**
* **The Problem:** YouTube rejects *all* NGN cards (even virtual ones).
* **My Solution:** I issue a **Virtual USD Card** (via Maplerad).
* **The Math:**
    * YouTube US Cost: ~$13.99 (Too expensive) OR YouTube Nigeria charged in USD equivalent (~$1.50).
    * **I Charge:** Calculated dynamically based on the current black market rate.
    * **Risk:** FX rates fluctuate daily. If the Naira crashes, my user might stop paying because the subscription becomes too expensive.

---

### **3. The Technical Architecture**

I don't need a complex app to start. I will begin with a simple web dashboard.

**Step 1: User Onboarding**
* User signs up on my site.
* **KYC is mandatory:** I must verify their BVN/NIN using APIs like **Dojah** or **Identitypass**. I cannot skip this, or bad actors will use my cards for fraud and get my platform shut down.

**Step 2: Wallet Funding**
* The user transfers ₦3,000 to a unique bank account I generate for them.
* **Tool:** I will use **Monnify** or **Paystack** to generate "Virtual Accounts" for users to transfer money to.

**Step 3: Card Creation**
* My backend listens for the transfer -> Triggers the Card API (e.g., Maplerad `create_card`) -> Returns card details (PAN, CVV, Expiry).
* I display the card on the user's dashboard.

**Step 4: The "Subscription" Feature**
Since I want to handle this automatically, I have two choices:
1.  **User does it:** The user copies the card details to YouTube. I send automated reminders for them to top up their wallet monthly. (Easiest MVP).
2.  **I do it (Concierge):** I ask for their YouTube login. (Riskier, but offers a "premium" service).

---

### **4. Critical Challenges I Must Watch**

* **BIN Rejection:** YouTube's payment processor (Google Pay) sometimes blocks specific "BINs" (the first 6 digits of a card) if they detect they are from a "Prepaid/Virtual" provider.
    * **Action:** Before building the full app, I will contact Bridgecard/Maplerad support and ask: *"Do your cards work on Google Services / YouTube Premium specifically?"*
* **Exchange Rate Fluctuation:** If I use USD cards, a sudden drop in Naira value will wipe out my profit margin if I charge users a fixed Naira price.
    * **Action:** I will always charge users a fee + the *current* exchange rate, or keep a buffer in my pricing.
