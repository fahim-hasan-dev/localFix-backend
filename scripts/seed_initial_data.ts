import mongoose from "mongoose";
import colors from "colors";
import config from "../src/config";
import { Category } from "../src/app/modules/category/category.model";
import { Marquee, MarqueeSetting } from "../src/app/modules/marquee/marquee.model";
import { Faq } from "../src/app/modules/faq/faq.model";
import { Rule } from "../src/app/modules/rule/rule.model";
import { RULE_TYPE } from "../src/app/modules/rule/rule.interface";
import { User } from "../src/app/modules/user/user.model";
import { Service } from "../src/app/modules/service/service.model";
import {
  APPROVAL_STATUS,
  CHECKR_INVITATION_STATUS,
  CHECKR_VERIFICATION_STATUS,
  GENDER,
  STATUS,
  USER_ROLES,
} from "../src/enums/user";
import { escapeRegex } from "../src/helpers/searchHelper";

const SEED_CATEGORIES = [
  {
    name: "Plumbing",
    coverImage:
      "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=1200&q=80",
    isActive: true,
  },
  {
    name: "Electrical",
    coverImage:
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1200&q=80",
    isActive: true,
  },
  {
    name: "HVAC",
    coverImage:
      "https://images.unsplash.com/photo-1591357167522-61d54313c8a4?auto=format&fit=crop&w=1200&q=80",
    isActive: true,
  },
  {
    name: "Handyman",
    coverImage:
      "https://images.unsplash.com/photo-1505798577917-a65157d3320a?auto=format&fit=crop&w=1200&q=80",
    isActive: true,
  },
  {
    name: "Appliance Repair",
    coverImage:
      "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80",
    isActive: true,
  },
  {
    name: "Painting",
    coverImage:
      "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=1200&q=80",
    isActive: true,
  },
  {
    name: "Landscaping",
    coverImage:
      "https://images.unsplash.com/photo-1557429287-b2e26467fc2b?auto=format&fit=crop&w=1200&q=80",
    isActive: true,
  },
  {
    name: "Roofing",
    coverImage:
      "https://images.unsplash.com/photo-1632759145351-1d592919f522?auto=format&fit=crop&w=1200&q=80",
    isActive: true,
  },
  {
    name: "Pest Control",
    coverImage:
      "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=80",
    isActive: true,
  },
  {
    name: "House Cleaning",
    coverImage:
      "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1600&q=80",
    isActive: true,
  },
];

const SEED_MARQUEE_KEYWORDS = SEED_CATEGORIES.map((cat, index) => ({
  keyword: cat.name,
  isEnabled: true,
  order: index + 1,
}));

const SEED_FAQS = [
  // Homeowner FAQs
  {
    role: USER_ROLES.HOME_OWNER,
    order: 1,
    question: "Do I need an account to browse contractors?",
    answer:
      "No. You can freely explore verified local contractor profiles, read authentic customer reviews, and check past project photos without creating an account. You only need a free account when you're ready to post a job and receive competitive bids.",
  },
  {
    role: USER_ROLES.HOME_OWNER,
    order: 2,
    question: "Is it free to get quotes, and am I obligated to hire?",
    answer:
      "Getting quotes is 100% free with zero obligation. You can post your repair request, compare itemized quotes side-by-side from background-checked local specialists, and only hire if you find a pro that matches your budget and schedule.",
  },
  {
    role: USER_ROLES.HOME_OWNER,
    order: 3,
    question: "Are contractors licensed, insured, and background-checked?",
    answer:
      "Yes. Trade specialists (electricians, plumbers, HVAC technicians) must hold active state trade licenses and commercial liability insurance. All independent pros pass identity verification and criminal background screening before joining.",
  },
  {
    role: USER_ROLES.HOME_OWNER,
    order: 4,
    question: "How do payments work?",
    answer:
      "You agree on the price and pay your contractor directly after the job is completed to your satisfaction—via credit card, check, cash, or digital transfer. Local Fix never holds your funds or charges middleman checkout surcharges.",
  },
  {
    role: USER_ROLES.HOME_OWNER,
    order: 5,
    question: "What happens if I'm not satisfied or an issue arises?",
    answer:
      "Contractors provide clear itemized scopes and standard workmanship warranties on their repairs. If questions or discrepancies occur, our customer support team is available to help mediate and ensure a fair resolution.",
  },
  {
    role: USER_ROLES.HOME_OWNER,
    order: 6,
    question: "Can I get same-day or emergency repair services?",
    answer:
      "Yes. Many of our local pros offer emergency callouts for burst pipes, electrical shorts, and sudden AC failures. When posting your request, simply select 'Urgent / ASAP' to notify on-duty technicians immediately.",
  },
  {
    role: USER_ROLES.HOME_OWNER,
    order: 7,
    question: "How quickly do contractors respond to requests?",
    answer:
      "Most standard repair requests receive their first 2 to 3 itemized quotes within 15 to 45 minutes during normal business hours.",
  },
  {
    role: USER_ROLES.HOME_OWNER,
    order: 8,
    question: "What if I'm not sure which trade to pick?",
    answer:
      "Use our 'Describe Issue' tool on the homepage. Just explain what you see, hear, or smell in everyday words, and our system will route it to the right licensed trade (or a trusted handyman).",
  },
  // Service Provider / Pro FAQs
  {
    role: USER_ROLES.PROFESSIONAL,
    order: 1,
    question: "How much does it cost for contractors to join?",
    answer:
      "We offer a free trial (length depends on the plan) with directory listing and quoting once your background screening is cleared. Afterward, membership is a flat monthly or yearly subscription from the packages listed on the site. We charge 0% commission on your jobs and never charge per-lead fees.",
  },
  {
    role: USER_ROLES.PROFESSIONAL,
    order: 2,
    question: "Do you take a cut of my earnings or charge for leads?",
    answer:
      "Never. Unlike Angi, Thumbtack, or Yelp that sell expensive, shared leads to 4+ pros or take a 15–25% cut of every project, Local Fix operates on a transparent, flat monthly subscription. You keep 100% of every dollar you charge.",
  },
  {
    role: USER_ROLES.PROFESSIONAL,
    order: 3,
    question: "Do you sell the same lead to multiple contractors?",
    answer:
      "No. Homeowners either book you directly from your verified public profile or post an open repair request where verified pros submit transparent quotes. We never engage in pay-per-lead bidding wars or charge you to contact a client.",
  },
  {
    role: USER_ROLES.PROFESSIONAL,
    order: 4,
    question: "How do I receive leads and job notifications?",
    answer:
      "Once cleared, you receive instant SMS and email notifications whenever a homeowner in your designated service radius posts a request in your trade. You can inspect project photos, descriptions, and urgency before submitting an itemized bid.",
  },
  {
    role: USER_ROLES.PROFESSIONAL,
    order: 5,
    question: "What documents are required to clear compliance verification?",
    answer:
      "Trade pros must submit proof of relevant state or municipal trade licensing (for plumbing, electrical, and HVAC) and a Certificate of Insurance (COI) showing at least $1,000,000 in general liability coverage. Identity and background screening are completed via Checkr.",
  },
  {
    role: USER_ROLES.PROFESSIONAL,
    order: 6,
    question: "How quickly is my contractor application audited and approved?",
    answer:
      "Our compliance team audits submitted licenses against state licensing registries within 24 business hours. Automated license status checks run regularly to maintain your Verified Pro badge.",
  },
  {
    role: USER_ROLES.PROFESSIONAL,
    order: 7,
    question: "How and when do homeowners pay me?",
    answer:
      "Homeowners pay you directly upon job completion using your preferred payment methods (cash, check, card, or direct transfer). Local Fix never withholds your funds or charges checkout processing surcharges.",
  },
  {
    role: USER_ROLES.PROFESSIONAL,
    order: 8,
    question: "Can I pause or cancel my membership anytime?",
    answer:
      "Yes. There are no lock-in contracts or cancellation penalties. You can pause or cancel your subscription at any time with one click from your Pro Dashboard settings.",
  },
];

const TERMS_HTML = `
<h2>1. Marketplace Role</h2>
<p>Local Fix provides a marketplace where homeowners describe projects and independent professionals offer services. Local Fix is not the employer, contractor, agent, or insurer of either party. Contracts and workmanship warranties are agreed upon directly between the homeowner and the independent professional.</p>

<h2>2. Accounts &amp; Verification</h2>
<p>You must provide accurate information and use the platform only for lawful purposes. Provider licenses, insurance, and background screening claims are not marked as verified until Local Fix confirms them. Misrepresentation or fraudulent claims may result in immediate account suspension.</p>

<h2>3. Projects, Quotes, and Payments</h2>
<p>Homeowners review itemized quotes and select a provider at their discretion. Professionals are solely responsible for their quotes, permits, taxes, and workmanship. Homeowners pay contractors directly upon job completion—Local Fix does not hold customer project funds or add checkout surcharges.</p>

<h2>4. Background Screening</h2>
<p>Provider participation may require a Checkr hosted background screening. All sensitive identity identifiers are encrypted and collected directly by Checkr. Users must never share Social Security Numbers, government IDs, or report contents via chat or messages.</p>

<h2>5. Acceptable Use</h2>
<p>You may not misuse personal information, bypass marketplace safeguards, scrape contact details, impersonate others, or submit deceptive quotes or reviews.</p>

<h2>6. Changes to Terms</h2>
<p>Material updates to these Terms &amp; Conditions are posted on this page with an updated effective date. Questions may be directed to our customer support team through the Contact page.</p>
`.trim();

const PRIVACY_HTML = `
<h2>1. Information We Collect</h2>
<p>We collect account profile details, service requests, quotes, messages, reviews, provider licensing and insurance credentials, optional location coordinates, and security/device metadata strictly needed to operate the marketplace.</p>

<h2>2. How We Use Your Information</h2>
<p>Your information is used to operate accounts and service requests, match homeowners with local verified professionals, verify contractor eligibility, send service notifications, and prevent fraud or abuse.</p>

<h2>3. Background Screening Isolation</h2>
<p>Checkr collects sensitive screening identifiers (such as SSN and government ID details) directly on its certified, encrypted infrastructure. Local Fix stores only normalized verification status and audit timestamps, never raw report contents.</p>

<h2>4. Information Sharing</h2>
<p>We share relevant contact and project details only with the other party on an active job, as well as essential infrastructure vendors (such as identity verification and messaging providers) or legal authorities when required by law. We never sell or rent personal information to third-party brokers or ad networks.</p>

<h2>5. Your Choices &amp; Data Rights</h2>
<p>You can update your account details, control optional location sharing, and request access to or deletion of your account data at any time through account settings or by contacting our support desk.</p>

<h2>6. Age Restriction</h2>
<p>Local Fix is intended exclusively for homeowners, property managers, and independent trade professionals aged 18 and older.</p>
`.trim();

const SEED_PROVIDERS = [
  {
    categoryName: "Plumbing",
    user: {
      name: "Luis Ortega",
      companyName: "Ortega Plumbing",
      email: "luis.ortega@localfix.com",
      password: "LocalFix@123",
      role: USER_ROLES.PROFESSIONAL,
      gender: GENDER.MALE,
      phone: "+15125550198",
      countryCode: "+1",
      verified: true,
      status: STATUS.ACTIVE,
      approvalStatus: APPROVAL_STATUS.APPROVED,
      agreedToTerms: true,
      termsAcceptedAt: new Date(),
      about:
        "Over 10 years of trusted residential and light commercial plumbing across Austin and Travis County. Specializing in emergency leak detection, water heater repairs and replacements, sewer line snaking, and whole-home repiping with upfront itemized pricing.",
      yearsOfExperience: "10+",
      serviceRadiusInMiles: 25,
      city: "Austin",
      state: "TX",
      zipCode: "78704",
      streetAddress: "2201 South Lamar Blvd",
      location: {
        type: "Point" as const,
        coordinates: [-97.7632, 30.2454],
        address: "2201 South Lamar Blvd, Austin, TX 78704",
      },
      startingRate: 95,
      hourlyRate: 95,
      responseTime: "Replies in ~15 mins",
      availability: "Available this week",
      acceptedPayments: ["Credit Card", "Debit Card", "Cash", "Check"],
      businessHours: {
        mode: "all_days" as const,
        allDays: { isOpen: true, openTime: "8:00 AM", closeTime: "6:00 PM" },
        emergencyDispatchAvailable: true,
      },
      tradeLicense: {
        licenseNumber: "TX-PLB-48291",
        state: "TX",
        certificateUrl: "",
        isVerified: true,
      },
      liabilityInsurance: {
        carrier: "Travelers Commercial",
        coverage: "$1,000,000",
        expires: "2027-12-31",
        certificateUrl: "",
        isVerified: true,
      },
      backgroundCheck: {
        consentAccepted: true,
        consentAcceptedAt: new Date(),
        status: CHECKR_VERIFICATION_STATUS.VERIFIED,
        passed: true,
        invitationStatus: CHECKR_INVITATION_STATUS.COMPLETED,
        result: "clear",
        verifiedAt: new Date(),
        lastCheckedAt: new Date(),
      },
    },
    services: [
      {
        name: "Leak Detection & Pipe Repair",
        description:
          "Acoustic leak locating and copper, PEX, or PVC pipe repairs for walls, slabs, and under-sink lines.",
      },
      {
        name: "Water Heater Repair & Installation",
        description:
          "Diagnostics, thermostat/element replacement, and full tank or tankless water heater installations.",
      },
      {
        name: "Drain Cleaning & Hydro Jetting",
        description:
          "Fast clearing of kitchen, bathroom, and main sewer line clogs with camera inspection available.",
      },
      {
        name: "Faucet, Toilet & Fixture Replacement",
        description:
          "Clean installation and sealing of sinks, faucets, garbage disposals, and toilets.",
      },
    ],
  },
  {
    categoryName: "Electrical",
    user: {
      name: "Priya Shah",
      companyName: "Shah Electric Co.",
      email: "priya.shah@localfix.com",
      password: "LocalFix@123",
      role: USER_ROLES.PROFESSIONAL,
      gender: GENDER.FEMALE,
      phone: "+12145550174",
      countryCode: "+1",
      verified: true,
      status: STATUS.ACTIVE,
      approvalStatus: APPROVAL_STATUS.APPROVED,
      agreedToTerms: true,
      termsAcceptedAt: new Date(),
      about:
        "Master electrical specialist serving Dallas, Plano, and surrounding communities for 8+ years. Specializing in 200A panel upgrades, EV home charger installations, dedicated circuits, recessed LED lighting, and code-compliant safety inspections.",
      yearsOfExperience: "8+",
      serviceRadiusInMiles: 30,
      city: "Dallas",
      state: "TX",
      zipCode: "75201",
      streetAddress: "1500 Main Street",
      location: {
        type: "Point" as const,
        coordinates: [-96.797, 32.7767],
        address: "1500 Main Street, Dallas, TX 75201",
      },
      startingRate: 85,
      hourlyRate: 85,
      responseTime: "Replies in ~20 mins",
      availability: "Available this week",
      acceptedPayments: ["Credit Card", "Debit Card", "Cash", "Check"],
      businessHours: {
        mode: "all_days" as const,
        allDays: { isOpen: true, openTime: "8:00 AM", closeTime: "6:00 PM" },
        emergencyDispatchAvailable: false,
      },
      tradeLicense: {
        licenseNumber: "TX-ELC-91042",
        state: "TX",
        certificateUrl: "",
        isVerified: true,
      },
      liabilityInsurance: {
        carrier: "Hartford Business",
        coverage: "$1,000,000",
        expires: "2027-12-31",
        certificateUrl: "",
        isVerified: true,
      },
      backgroundCheck: {
        consentAccepted: true,
        consentAcceptedAt: new Date(),
        status: CHECKR_VERIFICATION_STATUS.VERIFIED,
        passed: true,
        invitationStatus: CHECKR_INVITATION_STATUS.COMPLETED,
        result: "clear",
        verifiedAt: new Date(),
        lastCheckedAt: new Date(),
      },
    },
    services: [
      {
        name: "200A Electrical Panel Upgrade",
        description:
          "Full breaker panel replacements, whole-home surge protection, and code compliance labeling.",
      },
      {
        name: "EV Home Charger Installation",
        description:
          "Dedicated 240V NEMA 14-50 outlets and hardwired Level 2 EV wall connectors for all vehicle brands.",
      },
      {
        name: "Recessed Lighting & Ceiling Fans",
        description:
          "Clean installation of LED wafer lights, dimmer switches, chandeliers, and ceiling fans.",
      },
      {
        name: "Outlet, GFCI & Breaker Troubleshooting",
        description:
          "Diagnosing tripping breakers, dead outlets, flickering lights, and GFCI/AFCI protection upgrades.",
      },
    ],
  },
];

async function seedCategories() {
  const categoryMap = new Map<string, mongoose.Types.ObjectId>();
  let createdCount = 0;

  for (const item of SEED_CATEGORIES) {
    let existing = await Category.findOne({
      name: new RegExp(`^${escapeRegex(item.name)}$`, "i"),
    });

    if (!existing) {
      existing = await Category.create(item);
      createdCount += 1;
    }

    categoryMap.set(item.name.toLowerCase(), existing._id as mongoose.Types.ObjectId);
  }

  console.log(
    colors.green(
      `✔ Categories ready: ${categoryMap.size} total (${createdCount} newly created)`,
    ),
  );
  return categoryMap;
}

async function seedMarquee() {
  const setting = await MarqueeSetting.findOne();
  if (!setting) {
    await MarqueeSetting.create({ isEnabled: true });
  }

  let createdCount = 0;
  for (const item of SEED_MARQUEE_KEYWORDS) {
    const existing = await Marquee.findOne({
      keyword: new RegExp(`^${escapeRegex(item.keyword)}$`, "i"),
    });
    if (!existing) {
      await Marquee.create(item);
      createdCount += 1;
    }
  }

  console.log(
    colors.green(
      `✔ Homepage hero auto-slider (Marquee) ready: ${SEED_MARQUEE_KEYWORDS.length} items (${createdCount} newly created)`,
    ),
  );
}

async function seedFaqs() {
  let createdCount = 0;

  for (const item of SEED_FAQS) {
    const existing = await Faq.findOne({
      role: item.role,
      question: new RegExp(`^${escapeRegex(item.question)}$`, "i"),
    });

    if (!existing) {
      await Faq.create(item);
      createdCount += 1;
    }
  }

  console.log(
    colors.green(
      `✔ FAQs ready: ${SEED_FAQS.length} total (${createdCount} newly created)`,
    ),
  );
}

async function seedLegalRules() {
  await Rule.findOneAndUpdate(
    { type: RULE_TYPE.TERMS },
    { type: RULE_TYPE.TERMS, content: TERMS_HTML },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  await Rule.findOneAndUpdate(
    { type: RULE_TYPE.PRIVACY },
    { type: RULE_TYPE.PRIVACY, content: PRIVACY_HTML },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  console.log(colors.green("✔ Terms & Conditions and Privacy Policy ready"));
}

async function seedServiceProvidersAndServices(
  categoryMap: Map<string, mongoose.Types.ObjectId>,
) {
  let providerCreated = 0;
  let serviceCreated = 0;

  for (const entry of SEED_PROVIDERS) {
    const categoryId = categoryMap.get(entry.categoryName.toLowerCase());
    if (!categoryId) {
      throw new Error(`Missing category for provider: ${entry.categoryName}`);
    }

    let provider = await User.findOne({ email: entry.user.email });
    if (!provider) {
      provider = await User.create({
        ...entry.user,
        category: categoryId,
      });
      providerCreated += 1;
    }

    for (const svc of entry.services) {
      const existingService = await Service.findOne({
        professional: provider._id,
        name: new RegExp(`^${escapeRegex(svc.name)}$`, "i"),
      });

      if (!existingService) {
        await Service.create({
          professional: provider._id,
          category: categoryId,
          name: svc.name,
          description: svc.description,
        });
        serviceCreated += 1;
      }
    }
  }

  console.log(
    colors.green(
      `✔ Service Providers ready: ${SEED_PROVIDERS.length} total (${providerCreated} newly created), Services newly created: ${serviceCreated}`,
    ),
  );
}

async function main() {
  if (!config.database_url) {
    throw new Error("DATABASE_URL is not configured in .env");
  }
  if (!config.bcrypt_salt_rounds) {
    config.bcrypt_salt_rounds = "12";
  }

  await mongoose.connect(config.database_url);
  console.log(colors.cyan("Connected to MongoDB. Seeding initial data..."));

  const categoryMap = await seedCategories();
  await seedMarquee();
  await seedFaqs();
  await seedLegalRules();
  await seedServiceProvidersAndServices(categoryMap);

  console.log(colors.bold.green("\n🎉 Initial seed completed successfully!"));
  console.log(colors.yellow("Seeded Service Provider Logins:"));
  for (const entry of SEED_PROVIDERS) {
    console.log(
      `  - ${entry.user.companyName} (${entry.categoryName}): ${entry.user.email} / ${entry.user.password}`,
    );
  }
}

main()
  .catch((error) => {
    console.error(colors.red("❌ Seed failed:"), error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
