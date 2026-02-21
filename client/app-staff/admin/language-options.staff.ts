/*
 * Copyright (C) 2015-2026 Kaj Magnus Lindberg
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */


//------------------------------------------------------------------------------
   namespace debiki2.admin {
//------------------------------------------------------------------------------


export function languageOptions(): LabelValue[] {
  return [..._languageOptions];
}

// Sync this list with the language files in /translations/ and the server scripts bundle. [5JUKQR2].
// And with the ElasticSearch analyzers — but that's probably done now once and for all?
// New commonly spoken languages don't pop up that often. [multilingual_mapping]
//
// Sort by language name. (In the ElasticSearch mapping, though, we sort by lang code.)
//
const _languageOptions: LabelValue[] = [
        // Add _English_twice: here at the top, so simpler to find.
        // Don't mention this is en-US, people might then want -GB too and -AU (for the
        // UK and Australia)?
        { value: 'en_US',  label: "English"                      },
        // This is Modern Standard Arabic (MSA), which is commonly used in
        // books, apps, the Internet in the Arab world. [says_Gemini]
        { value: 'ar_SA',  label: "Arabic"                       },
        { value: 'hy_AM',  label: "Armenian"                     },
        // BD = Bangladesh
        { value: 'bn_BD',  label: "Bengali"                      },
        { value: 'bg_BG',  label: "Bulgarian"                    },
        { value: 'zh_CN',  label: "Chinese (Simplified)"         },
        { value: 'zh_TW',  label: "Chinese (Traditional)"        },
        { value: 'cs_CZ',  label: "Czech"                        },
        { value: 'da_DK',  label: "Danish"                       },
        { value: 'nl_NL',  label: "Dutch"                        },
        // Add _English_twice, here too — alphabetically.
        { value: 'en_US',  label: "English"                      },
        { value: 'et_EE',  label: "Estonian"                     },
        { value: 'fa_IR',  label: "Farsi (Persian)"              },
        { value: 'fi_FI',  label: "Finnish"                      },
        { value: 'fr_FR',  label: "French"                       },
        { value: 'de_DE',  label: "German"                       },
        { value: 'el_GR',  label: "Greek"                        },
        { value: 'he_IL',  label: "Hebrew"                       },
        { value: 'hi_IN',  label: "Hindi"                        },
        { value: 'hu_HU',  label: "Hungarian"                    },
        { value: 'is_IS',  label: "Icelandic"                    },
        { value: 'id_ID',  label: "Indonesian"                   },
        { value: 'ga_IE',  label: "Irish"                        },
        { value: 'it_IT',  label: "Italian"                      },
        { value: 'ja_JP',  label: "Japanese"                     },
        { value: 'ko_KR',  label: "Korean"                       },
        // IQ = Iraq
        { value: 'ckb_IQ', label: "Kurdish (Sorani)"             },
        // TR = Türkiye
        { value: 'ku_TR',  label: "Kurdish (Kurmanji)"           },
        { value: 'lv_LV',  label: "Latvian"                      },
        { value: 'lt_LT',  label: "Lithuanian"                   },
        { value: 'no_NO',  label: "Norwegian"                    },
        { value: 'pl_PL',  label: "Polish"                       },
        { value: 'pt_BR',  label: "Portuguese (Brazil)"          },
        { value: 'pt_PT',  label: "Portuguese (Portugal)"        },
        { value: 'ro_RO',  label: "Romanian"                     },
        { value: 'ru_RU',  label: "Russian"                      },
        { value: 'sr_RS',  label: "Serbian"                      },
        // The language code we've been using this far is for "Spanish (Chile)".
        // Some day, let's change to es_MX, for Mexico [use_Mexican_Spanish]. There's more
        // Spanish speakers in Mexico than in Chile. Doesn't make sense with localized
        // flavors of Spanish — they're so similar, and ElasticSearch uses the same analyzer
        // (however there's different analyzers for Portuguese: a Brazilian and a Portuguese).
        // For now, let's call 'es_CL' just "Spanish", and later on rename it to "es_MX"
        // (but still call this Spanish).
        { value: 'es_CL',  label: "Spanish"                      },
        { value: 'sv_SE',  label: "Swedish"                      },
        { value: 'th_TH',  label: "Thai"                         },
        { value: 'tr_TR',  label: "Turkish"                      },
        { value: 'uk_UA',  label: "Ukrainian"                    },
        ];

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
