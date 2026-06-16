/**
 * @fileoverview Central configuration module for Carbon Ledger.
 * Contains all emission factors, category mappings, AI provider config,
 * and application constants. Frozen at runtime to prevent mutation.
 *
 * Emission factor sources:
 * - Transport/Energy: DEFRA UK GHG Conversion Factors 2023
 * - Food: Our World in Data / Poore & Nemecek (2018)
 * - Electricity (India): CEA CO2 Baseline Database v18 (2022-23), 0.82 kg/kWh
 * - Tree sequestration: IPCC AR6 average 21.7 kg CO2/tree/year
 *
 * @module config
 * @version 1.0.0
 */

'use strict';

/**
 * @typedef {Object} EmissionAction
 * @property {string} saving      - Human-readable annual saving estimate (e.g. '-250 kg/yr')
 * @property {string} description - Short description of the action
 * @property {string} difficulty  - Difficulty level: 'Easy' | 'Medium' | 'Hard'
 * @property {string} query       - Pre-filled AI planner query string
 */

/**
 * @typedef {Object} AIProvider
 * @property {string} endpoint - HTTPS endpoint for the AI API
 * @property {string} model    - Model identifier string
 * @property {string} name     - Human-readable provider name
 */

/**
 * Global application configuration object.
 * Immutable after initialisation (Object.freeze applied recursively).
 * @namespace CONFIG
 */
const CONFIG = Object.freeze({

  /**
   * Emission factors in kg CO2-equivalent per unit of activity.
   * Positive values = emissions (debits). Negative = sequestration (credits).
   * @type {Object.<string, number>}
   */
  EMISSION_FACTORS: Object.freeze({
    car:           0.21,   // kg CO2e per km (avg petrol car, Indian roads, DEFRA 2023)
    flight:        255,    // kg CO2e per domestic flight (avg 1000km economy, IPCC AR6)
    meatmeal:      6.0,    // kg CO2e per meal containing meat (Poore & Nemecek 2018)
    vegmeal:       1.8,    // kg CO2e per vegetarian meal (Poore & Nemecek 2018)
    electricbill:  0.82,   // kg CO2e per kWh (CEA India grid intensity 2022-23)
    gasbill:       2.04,   // kg CO2e per kg LPG burned (IPCC AR6)
    online_order:  3.2,    // kg CO2e per order (packaging + last-mile, MIT study)
    custom_debit:  1,      // User enters kg CO2e directly; factor = 1
    tree:         -21.7,   // kg CO2e sequestered per tree per year (IPCC AR6 avg)
    transit:      -0.89,   // kg CO2e saved per trip replacing ~10km car journey
    solar:        -0.82,   // kg CO2e avoided per kWh generated (displaces India grid)
    custom_credit: -1,     // User enters kg CO2e directly; factor = -1
  }),

  /**
   * Display units shown alongside quantity inputs and in ledger entries.
   * @type {Object.<string, string>}
   */
  UNITS: Object.freeze({
    car:           'km',
    flight:        'flights',
    meatmeal:      'meals',
    vegmeal:       'meals',
    electricbill:  'kWh',
    gasbill:       'kg LPG',
    online_order:  'orders',
    custom_debit:  'kg CO\u2082',
    tree:          'trees',
    transit:       'trips',
    solar:         'kWh',
    custom_credit: 'kg CO\u2082',
  }),

  /**
   * Human-readable display names for each activity key.
   * Used in auto-generated entry descriptions and UI labels.
   * @type {Object.<string, string>}
   */
  NAMES: Object.freeze({
    car:           'Car journey',
    flight:        'Flight',
    meatmeal:      'Meat meal',
    vegmeal:       'Vegetarian meal',
    electricbill:  'Electricity',
    gasbill:       'Gas / LPG',
    online_order:  'Online order',
    custom_debit:  'Custom emission',
    tree:          'Tree planted',
    transit:       'Public transit',
    solar:         'Solar energy',
    custom_credit: 'Custom offset',
  }),

  /**
   * Maps each activity key to its chart/visual category.
   * Used for colour-coding tags and grouping bar chart data.
   * @type {Object.<string, string>}
   */
  CATEGORY_MAP: Object.freeze({
    car:           'transport',
    flight:        'transport',
    meatmeal:      'food',
    vegmeal:       'food',
    electricbill:  'energy',
    gasbill:       'energy',
    online_order:  'shopping',
    custom_debit:  'other',
    tree:          'offset',
    transit:       'offset',
    solar:         'offset',
    custom_credit: 'offset',
  }),

  /**
   * CSS class names for category pill tags in the ledger table.
   * @type {Object.<string, string>}
   */
  TAG_CLASS: Object.freeze({
    transport: 'tag-transport',
    food:      'tag-food',
    energy:    'tag-energy',
    shopping:  'tag-shopping',
    offset:    'tag-offset',
    other:     'tag-transport',
  }),

  /**
   * Monthly carbon footprint benchmarks in kg CO2 per person.
   * Used in the Analysis tab benchmark comparison table.
   * @type {{ indiaAvg: number, globalAvg: number, parisTarget: number }}
   */
  BENCHMARKS: Object.freeze({
    indiaAvg:    133,  // India per-capita monthly average (World Bank 2023)
    globalAvg:   375,  // Global per-capita monthly average (IEA 2023)
    parisTarget: 167,  // Monthly budget consistent with 1.5°C pathway (IPCC SR1.5)
  }),

  /**
   * Pre-defined high-impact reduction action cards shown in the Actions tab.
   * Each card links to a pre-filled AI planner query.
   * @type {EmissionAction[]}
   */
  ACTIONS: Object.freeze([
    Object.freeze({
      saving:      '-250 kg/yr',
      description: 'Skip meat 4 days a week. Biggest single diet change you can make.',
      difficulty:  'Medium',
      query:       'How do I shift to a mostly vegetarian diet and how much CO2 will I save per year in India?',
    }),
    Object.freeze({
      saving:      '-180 kg/yr',
      description: 'Switch to LED bulbs + 5-star rated AC. Low effort, immediate savings.',
      difficulty:  'Easy',
      query:       'What are the best ways to reduce home electricity consumption in India, with carbon savings?',
    }),
    Object.freeze({
      saving:      '-340 kg/yr',
      description: 'Replace 3 car trips per week with metro or bus. The biggest transport win.',
      difficulty:  'Medium',
      query:       'How do I calculate car vs metro carbon savings for a daily commute in an Indian city?',
    }),
    Object.freeze({
      saving:      '-100 kg/yr',
      description: 'Plant 5 trees via Indian NGO programs. Direct, verifiable offset.',
      difficulty:  'Easy',
      query:       'What are affordable carbon offset and tree-planting programs available in India?',
    }),
  ]),

  /**
   * AI provider configuration. Each provider is called via the backend proxy.
   * Keys must match the values in the model-select dropdown.
   * @type {Object.<string, AIProvider>}
   */
  AI_PROVIDERS: Object.freeze({
    claude: Object.freeze({
      endpoint: 'https://api.anthropic.com/v1/messages',
      model:    'claude-sonnet-4-6',
      name:     'Claude',
    }),
    grok: Object.freeze({
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      model:    'llama3-8b-8192',
      name:     'Grok',
    }),
  }),

  /** localStorage key for persisting ledger entries. @type {string} */
  STORAGE_KEY: 'carbon_ledger_entries_v1',

  /** Maximum character length for entry descriptions. @type {number} */
  MAX_DESC_LENGTH: 120,

  /** Maximum AI prompt length in characters sent to backend. @type {number} */
  MAX_PROMPT_LENGTH: 3000,
});
