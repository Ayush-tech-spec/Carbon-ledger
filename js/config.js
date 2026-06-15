/**
 * config.js
 * Central configuration: emission factors, categories, units, actions.
 * All values sourced from IPCC AR6, DEFRA 2023, CEA India 2022-23.
 */

const CONFIG = Object.freeze({

  /** kg CO2e per unit */
  EMISSION_FACTORS: {
    car:           0.21,    // per km (average petrol car, India)
    flight:        255,     // per flight (avg domestic 1000km, economy)
    meatmeal:      6.0,     // per meal (avg with beef/chicken mix)
    vegmeal:       1.8,     // per meal (mixed vegetarian)
    electricbill:  0.82,    // per kWh (CEA India grid intensity 2022-23)
    gasbill:       2.04,    // per kg LPG
    online_order:  3.2,     // per order (packaging + last-mile logistics)
    custom_debit:  1,       // user enters kg directly
    tree:         -21.7,    // per tree per year (avg sequestration)
    transit:      -0.89,    // per trip replacing car (avg 10km saved)
    solar:        -0.82,    // per kWh generated (displaces grid)
    custom_credit: -1,      // user enters kg directly
  },

  /** Display unit per category */
  UNITS: {
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
  },

  /** Human-readable display names */
  NAMES: {
    car:           'Car journey',
    flight:        'Flight',
    meatmeal:      'Meat meal',
    vegmeal:       'Vegetarian meal',
    electricbill:  'Electricity',
    gasbill:       'Gas/LPG',
    online_order:  'Online order',
    custom_debit:  'Custom emission',
    tree:          'Tree planted',
    transit:       'Public transit',
    solar:         'Solar energy',
    custom_credit: 'Custom offset',
  },

  /** Maps activity key to chart/tag category */
  CATEGORY_MAP: {
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
  },

  /** CSS class per category for tags */
  TAG_CLASS: {
    transport: 'tag-transport',
    food:      'tag-food',
    energy:    'tag-energy',
    shopping:  'tag-shopping',
    offset:    'tag-offset',
    other:     'tag-transport',
  },

  /** Benchmark values in kg CO2 per month */
  BENCHMARKS: {
    indiaAvg:     133,
    globalAvg:    375,
    parisTarget:  167,
  },

  /** Suggested reduction actions shown in Actions tab */
  ACTIONS: [
    {
      saving:      '-250 kg/yr',
      description: 'Skip meat 4 days a week. Biggest single diet change you can make.',
      difficulty:  'Medium',
      query:       'How do I shift to a mostly vegetarian diet and how much CO2 will I save per year in India?',
    },
    {
      saving:      '-180 kg/yr',
      description: 'Switch to LED bulbs + 5-star rated AC. Low effort, immediate savings.',
      difficulty:  'Easy',
      query:       'What are the best ways to reduce home electricity consumption in India, with their carbon savings?',
    },
    {
      saving:      '-340 kg/yr',
      description: 'Replace 3 car trips per week with metro or bus. The biggest transport win.',
      difficulty:  'Medium',
      query:       'How do I calculate car vs metro carbon savings for a daily commute in an Indian city?',
    },
    {
      saving:      '-100 kg/yr',
      description: 'Plant 5 trees via Indian NGO programs. Direct, verifiable offset.',
      difficulty:  'Easy',
      query:       'What are affordable carbon offset and tree-planting programs available in India?',
    },
  ],

  /** AI provider endpoints and model names */
  AI_PROVIDERS: {
    claude: {
      endpoint: 'https://api.anthropic.com/v1/messages',
      model:    'claude-sonnet-4-6',
      name:     'Claude',
    },
    grok: {
      endpoint: 'https://api.x.ai/v1/chat/completions',
      model:    'grok-3-mini',
      name:     'Grok',
    },
  },

  STORAGE_KEY: 'carbon_ledger_entries_v1',
  KEYS_STORAGE: 'carbon_ledger_api_keys_v1',
});
