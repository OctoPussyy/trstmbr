/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/tmb_game.json`.
 */
export type TmbGame = {
  "address": "Axew8h91qZGHhxWBeapvx8Fd7EXVk82xYQCY6kxRcBNv",
  "metadata": {
    "name": "tmbGame",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Trust Me Bros game protocol"
  },
  "instructions": [
    {
      "name": "acceptAuthority",
      "discriminator": [
        107,
        86,
        198,
        91,
        33,
        12,
        107,
        160
      ],
      "accounts": [
        {
          "name": "newAuthority",
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "buyTmb",
      "discriminator": [
        142,
        167,
        120,
        155,
        179,
        115,
        135,
        38
      ],
      "accounts": [
        {
          "name": "player",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "asset"
        },
        {
          "name": "broRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  114,
                  111
                ]
              },
              {
                "kind": "account",
                "path": "asset"
              },
              {
                "kind": "account",
                "path": "player"
              }
            ]
          }
        },
        {
          "name": "price",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  105,
                  99,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "tmbMint"
        },
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "vaultTmb",
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "tmbMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "cancelStaleSpin",
      "discriminator": [
        163,
        31,
        141,
        229,
        193,
        57,
        156,
        182
      ],
      "accounts": [
        {
          "name": "settler",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "prizes",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  105,
                  122,
                  101,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "broRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  114,
                  111
                ]
              },
              {
                "kind": "account",
                "path": "bro_record.asset",
                "account": "broRecord"
              },
              {
                "kind": "account",
                "path": "bro_record.owner",
                "account": "broRecord"
              }
            ]
          }
        },
        {
          "name": "spinRequest",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  112,
                  105,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "bro_record.asset",
                "account": "broRecord"
              },
              {
                "kind": "account",
                "path": "spin_request.nonce",
                "account": "spinRequest"
              }
            ]
          }
        },
        {
          "name": "owner",
          "writable": true
        },
        {
          "name": "escrowReceipt",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "bro_record.asset",
                "account": "broRecord"
              }
            ]
          }
        },
        {
          "name": "graveyard",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  114,
                  110,
                  101,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "bro_record.asset",
                "account": "broRecord"
              }
            ]
          }
        },
        {
          "name": "asset",
          "writable": true
        },
        {
          "name": "collection",
          "writable": true
        },
        {
          "name": "escrowAuth",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119,
                  95,
                  97,
                  117,
                  116,
                  104
                ]
              }
            ]
          }
        },
        {
          "name": "mplCoreProgram",
          "address": "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "claimHolding",
      "discriminator": [
        36,
        206,
        221,
        30,
        246,
        37,
        73,
        177
      ],
      "accounts": [
        {
          "name": "player",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "asset"
        },
        {
          "name": "broRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  114,
                  111
                ]
              },
              {
                "kind": "account",
                "path": "asset"
              },
              {
                "kind": "account",
                "path": "player"
              }
            ]
          }
        },
        {
          "name": "prizeMint"
        },
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "vaultToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "prizeMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "playerToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "player"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "prizeMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "index",
          "type": "u8"
        }
      ]
    },
    {
      "name": "createCollection",
      "discriminator": [
        156,
        251,
        92,
        54,
        233,
        2,
        16,
        82
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "collection",
          "writable": true,
          "signer": true
        },
        {
          "name": "mplCoreProgram",
          "address": "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "uri",
          "type": "string"
        }
      ]
    },
    {
      "name": "depositBro",
      "discriminator": [
        168,
        48,
        215,
        178,
        139,
        162,
        21,
        126
      ],
      "accounts": [
        {
          "name": "player",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "asset",
          "writable": true
        },
        {
          "name": "collection",
          "writable": true
        },
        {
          "name": "escrowReceipt",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "asset"
              }
            ]
          }
        },
        {
          "name": "broRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  114,
                  111
                ]
              },
              {
                "kind": "account",
                "path": "asset"
              },
              {
                "kind": "account",
                "path": "player"
              }
            ]
          }
        },
        {
          "name": "escrowAuth",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119,
                  95,
                  97,
                  117,
                  116,
                  104
                ]
              }
            ]
          }
        },
        {
          "name": "mplCoreProgram",
          "address": "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "depositTmb",
      "discriminator": [
        197,
        0,
        133,
        248,
        151,
        131,
        81,
        89
      ],
      "accounts": [
        {
          "name": "player",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "asset"
        },
        {
          "name": "broRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  114,
                  111
                ]
              },
              {
                "kind": "account",
                "path": "asset"
              },
              {
                "kind": "account",
                "path": "player"
              }
            ]
          }
        },
        {
          "name": "tmbMint"
        },
        {
          "name": "playerTmb",
          "writable": true
        },
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "vaultTmb",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "tmbMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "fundVault",
      "discriminator": [
        26,
        33,
        207,
        242,
        119,
        108,
        134,
        73
      ],
      "accounts": [
        {
          "name": "funder",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "source",
          "writable": true
        },
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "vaultToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initialize",
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "authority",
          "docs": [
            "Must be the program's upgrade authority (blocks front-running of initialization)."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "prizes",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  105,
                  122,
                  101,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "escrowAuth",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119,
                  95,
                  97,
                  117,
                  116,
                  104
                ]
              }
            ]
          }
        },
        {
          "name": "tmbMint"
        },
        {
          "name": "vaultTmb",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "tmbMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "program",
          "address": "Axew8h91qZGHhxWBeapvx8Fd7EXVk82xYQCY6kxRcBNv"
        },
        {
          "name": "programData"
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "configArgs"
            }
          }
        }
      ]
    },
    {
      "name": "mintBro",
      "discriminator": [
        115,
        28,
        117,
        90,
        7,
        92,
        232,
        151
      ],
      "accounts": [
        {
          "name": "player",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "asset",
          "docs": [
            "New Core asset keypair, generated by the client."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "collection",
          "writable": true
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "teamWallet",
          "writable": true
        },
        {
          "name": "broRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  114,
                  111
                ]
              },
              {
                "kind": "account",
                "path": "asset"
              },
              {
                "kind": "account",
                "path": "player"
              }
            ]
          }
        },
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "tmbMint"
        },
        {
          "name": "vaultTmb",
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "tmbMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "mplCoreProgram",
          "address": "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "uri",
          "type": "string"
        }
      ]
    },
    {
      "name": "proposeAuthority",
      "discriminator": [
        20,
        148,
        236,
        198,
        76,
        119,
        99,
        142
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "newAuthority",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "requestSpin",
      "discriminator": [
        186,
        157,
        114,
        217,
        55,
        116,
        223,
        114
      ],
      "accounts": [
        {
          "name": "player",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "asset"
        },
        {
          "name": "broRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  114,
                  111
                ]
              },
              {
                "kind": "account",
                "path": "asset"
              },
              {
                "kind": "account",
                "path": "player"
              }
            ]
          }
        },
        {
          "name": "spinRequest",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  112,
                  105,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "asset"
              },
              {
                "kind": "account",
                "path": "bro_record.total_spins",
                "account": "broRecord"
              }
            ]
          }
        },
        {
          "name": "randomnessAccount"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "rescue",
      "discriminator": [
        42,
        111,
        16,
        88,
        147,
        101,
        209,
        62
      ],
      "accounts": [
        {
          "name": "rescuer",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "rescuerAsset"
        },
        {
          "name": "rescuerBro",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  114,
                  111
                ]
              },
              {
                "kind": "account",
                "path": "rescuerAsset"
              },
              {
                "kind": "account",
                "path": "rescuer"
              }
            ]
          }
        },
        {
          "name": "graveyard",
          "docs": [
            "Closed on rescue; rent goes to the rescuer."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  114,
                  110,
                  101,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "graveyard.asset",
                "account": "graveyard"
              }
            ]
          }
        },
        {
          "name": "newAsset",
          "docs": [
            "New Core asset keypair, generated by the client."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "lastOwner"
        },
        {
          "name": "lastOwnerTmb",
          "docs": [
            "The previous owner's TMB token account (the client creates it if missing)."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "lastOwner"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "tmbMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "newBroRecord",
          "docs": [
            "Record of the re-minted Bro, owned by the RESCUER."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  114,
                  111
                ]
              },
              {
                "kind": "account",
                "path": "newAsset"
              },
              {
                "kind": "account",
                "path": "rescuer"
              }
            ]
          }
        },
        {
          "name": "collection",
          "writable": true
        },
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "tmbMint",
          "writable": true
        },
        {
          "name": "vaultTmb",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "tmbMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "treasury"
        },
        {
          "name": "treasuryTmb",
          "docs": [
            "The treasury's TMB token account (the client creates it if missing)."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "treasury"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "tmbMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "mplCoreProgram",
          "address": "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "fee",
          "type": "u64"
        }
      ]
    },
    {
      "name": "setPaused",
      "discriminator": [
        91,
        60,
        125,
        192,
        176,
        225,
        166,
        218
      ],
      "accounts": [
        {
          "name": "signer",
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "paused",
          "type": "bool"
        }
      ]
    },
    {
      "name": "setPrizes",
      "discriminator": [
        22,
        45,
        96,
        17,
        191,
        221,
        159,
        251
      ],
      "accounts": [
        {
          "name": "signer",
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "prizes",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  105,
                  122,
                  101,
                  115
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "entries",
          "type": {
            "vec": {
              "defined": {
                "name": "prize"
              }
            }
          }
        },
        {
          "name": "append",
          "type": "bool"
        },
        {
          "name": "finalize",
          "type": "bool"
        }
      ]
    },
    {
      "name": "setRoles",
      "discriminator": [
        119,
        86,
        129,
        161,
        55,
        23,
        250,
        12
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "rewardWallet",
          "type": {
            "option": "pubkey"
          }
        },
        {
          "name": "pauser",
          "type": {
            "option": "pubkey"
          }
        }
      ]
    },
    {
      "name": "setTmbPrice",
      "discriminator": [
        127,
        227,
        198,
        244,
        67,
        228,
        209,
        231
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "price",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  105,
                  99,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "lamportsPerTmb",
          "type": "u64"
        }
      ]
    },
    {
      "name": "settleSpin",
      "discriminator": [
        213,
        20,
        12,
        140,
        189,
        105,
        211,
        121
      ],
      "accounts": [
        {
          "name": "settler",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "prizes",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  105,
                  122,
                  101,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "broRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  114,
                  111
                ]
              },
              {
                "kind": "account",
                "path": "bro_record.asset",
                "account": "broRecord"
              },
              {
                "kind": "account",
                "path": "bro_record.owner",
                "account": "broRecord"
              }
            ]
          }
        },
        {
          "name": "spinRequest",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  112,
                  105,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "bro_record.asset",
                "account": "broRecord"
              },
              {
                "kind": "account",
                "path": "spin_request.nonce",
                "account": "spinRequest"
              }
            ]
          }
        },
        {
          "name": "owner",
          "writable": true
        },
        {
          "name": "escrowReceipt",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "bro_record.asset",
                "account": "broRecord"
              }
            ]
          }
        },
        {
          "name": "graveyard",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  114,
                  110,
                  101,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "bro_record.asset",
                "account": "broRecord"
              }
            ]
          }
        },
        {
          "name": "asset",
          "writable": true
        },
        {
          "name": "collection",
          "writable": true
        },
        {
          "name": "randomnessAccount"
        },
        {
          "name": "escrowAuth",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119,
                  95,
                  97,
                  117,
                  116,
                  104
                ]
              }
            ]
          }
        },
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "tmbMint"
        },
        {
          "name": "vaultTmb",
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "tmbMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "bonusAsset",
          "docs": [
            "Fresh keypair for a possible Bonus Bro. Required when the wheel has a Bonus Bro wedge."
          ],
          "writable": true,
          "signer": true,
          "optional": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "mplCoreProgram",
          "address": "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "updateConfig",
      "discriminator": [
        29,
        158,
        252,
        191,
        10,
        83,
        219,
        99
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "updateConfigArgs"
            }
          }
        }
      ]
    },
    {
      "name": "withdrawBro",
      "discriminator": [
        168,
        110,
        183,
        63,
        215,
        136,
        239,
        89
      ],
      "accounts": [
        {
          "name": "player",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "asset",
          "writable": true
        },
        {
          "name": "collection",
          "writable": true
        },
        {
          "name": "broRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  114,
                  111
                ]
              },
              {
                "kind": "account",
                "path": "asset"
              },
              {
                "kind": "account",
                "path": "player"
              }
            ]
          }
        },
        {
          "name": "escrowReceipt",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "asset"
              }
            ]
          }
        },
        {
          "name": "escrowAuth",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119,
                  95,
                  97,
                  117,
                  116,
                  104
                ]
              }
            ]
          }
        },
        {
          "name": "owner",
          "relations": [
            "broRecord"
          ]
        },
        {
          "name": "mplCoreProgram",
          "address": "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "withdrawTmb",
      "discriminator": [
        24,
        184,
        159,
        166,
        219,
        133,
        109,
        229
      ],
      "accounts": [
        {
          "name": "player",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "asset"
        },
        {
          "name": "broRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  114,
                  111
                ]
              },
              {
                "kind": "account",
                "path": "asset"
              },
              {
                "kind": "account",
                "path": "player"
              }
            ]
          }
        },
        {
          "name": "tmbMint"
        },
        {
          "name": "playerTmb",
          "writable": true
        },
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "vaultTmb",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "tmbMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdrawVault",
      "discriminator": [
        135,
        7,
        237,
        120,
        149,
        94,
        95,
        7
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "vaultToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "destination",
          "writable": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "broRecord",
      "discriminator": [
        248,
        122,
        215,
        154,
        123,
        250,
        233,
        89
      ]
    },
    {
      "name": "config",
      "discriminator": [
        155,
        12,
        170,
        224,
        30,
        250,
        204,
        130
      ]
    },
    {
      "name": "escrowReceipt",
      "discriminator": [
        5,
        104,
        57,
        114,
        177,
        192,
        135,
        10
      ]
    },
    {
      "name": "graveyard",
      "discriminator": [
        87,
        34,
        160,
        18,
        160,
        246,
        151,
        177
      ]
    },
    {
      "name": "prizeTable",
      "discriminator": [
        174,
        146,
        63,
        70,
        231,
        68,
        140,
        104
      ]
    },
    {
      "name": "spinRequest",
      "discriminator": [
        191,
        150,
        237,
        107,
        219,
        220,
        67,
        236
      ]
    },
    {
      "name": "tmbPrice",
      "discriminator": [
        219,
        70,
        223,
        255,
        177,
        27,
        47,
        234
      ]
    }
  ],
  "events": [
    {
      "name": "authorityAccepted",
      "discriminator": [
        166,
        192,
        219,
        188,
        41,
        209,
        195,
        26
      ]
    },
    {
      "name": "authorityProposed",
      "discriminator": [
        244,
        117,
        94,
        112,
        53,
        151,
        35,
        89
      ]
    },
    {
      "name": "broDeposited",
      "discriminator": [
        241,
        162,
        246,
        150,
        103,
        30,
        45,
        153
      ]
    },
    {
      "name": "broMinted",
      "discriminator": [
        255,
        6,
        199,
        192,
        23,
        142,
        233,
        223
      ]
    },
    {
      "name": "broWithdrawn",
      "discriminator": [
        55,
        137,
        240,
        124,
        120,
        159,
        140,
        96
      ]
    },
    {
      "name": "collectionCreated",
      "discriminator": [
        69,
        167,
        76,
        142,
        182,
        183,
        233,
        139
      ]
    },
    {
      "name": "configInitialized",
      "discriminator": [
        181,
        49,
        200,
        156,
        19,
        167,
        178,
        91
      ]
    },
    {
      "name": "configUpdated",
      "discriminator": [
        40,
        241,
        230,
        122,
        11,
        19,
        198,
        194
      ]
    },
    {
      "name": "holdingClaimed",
      "discriminator": [
        156,
        45,
        115,
        136,
        109,
        205,
        239,
        243
      ]
    },
    {
      "name": "pausedChanged",
      "discriminator": [
        12,
        10,
        153,
        247,
        60,
        115,
        137,
        69
      ]
    },
    {
      "name": "prizesSet",
      "discriminator": [
        2,
        24,
        72,
        168,
        130,
        83,
        84,
        81
      ]
    },
    {
      "name": "rescued",
      "discriminator": [
        121,
        161,
        19,
        44,
        228,
        240,
        254,
        193
      ]
    },
    {
      "name": "rolesUpdated",
      "discriminator": [
        81,
        37,
        176,
        32,
        30,
        204,
        251,
        246
      ]
    },
    {
      "name": "spinRequested",
      "discriminator": [
        5,
        102,
        137,
        134,
        36,
        245,
        26,
        73
      ]
    },
    {
      "name": "spinSettled",
      "discriminator": [
        31,
        68,
        15,
        166,
        151,
        136,
        158,
        67
      ]
    },
    {
      "name": "tmbBought",
      "discriminator": [
        133,
        208,
        149,
        113,
        93,
        78,
        13,
        221
      ]
    },
    {
      "name": "tmbDeposited",
      "discriminator": [
        49,
        143,
        188,
        76,
        22,
        174,
        137,
        50
      ]
    },
    {
      "name": "tmbPriceSet",
      "discriminator": [
        216,
        203,
        126,
        130,
        193,
        147,
        194,
        57
      ]
    },
    {
      "name": "tmbWithdrawn",
      "discriminator": [
        35,
        219,
        53,
        224,
        248,
        234,
        106,
        193
      ]
    },
    {
      "name": "vaultFunded",
      "discriminator": [
        192,
        119,
        245,
        193,
        55,
        223,
        195,
        50
      ]
    },
    {
      "name": "vaultWithdrawn",
      "discriminator": [
        238,
        9,
        219,
        172,
        188,
        77,
        72,
        104
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "paused",
      "msg": "The game is paused."
    },
    {
      "code": 6001,
      "name": "invalidSpinAmount",
      "msg": "Invalid spin amount."
    },
    {
      "code": 6002,
      "name": "notEnoughBags",
      "msg": "Not enough bags, bro. Top up your TMB."
    },
    {
      "code": 6003,
      "name": "broBurned",
      "msg": "This Bro has been burned."
    },
    {
      "code": 6004,
      "name": "notInEscrow",
      "msg": "Bro is not in escrow."
    },
    {
      "code": 6005,
      "name": "spinPending",
      "msg": "A spin is already pending for this Bro."
    },
    {
      "code": 6006,
      "name": "noSpinPending",
      "msg": "No spin is pending for this Bro."
    },
    {
      "code": 6007,
      "name": "notOwner",
      "msg": "Signer does not own this Bro."
    },
    {
      "code": 6008,
      "name": "randomnessNotReady",
      "msg": "Randomness has not been revealed yet."
    },
    {
      "code": 6009,
      "name": "randomnessAlreadyRevealed",
      "msg": "Randomness was already revealed at request time."
    },
    {
      "code": 6010,
      "name": "staleRandomness",
      "msg": "Randomness account is stale, foreign or malformed."
    },
    {
      "code": 6011,
      "name": "prizeTableInvalid",
      "msg": "Prize table is invalid."
    },
    {
      "code": 6012,
      "name": "missingRektWedge",
      "msg": "Prize table must contain exactly one REKT wedge."
    },
    {
      "code": 6013,
      "name": "poolReserveBreached",
      "msg": "Payout would breach the pool reserve."
    },
    {
      "code": 6014,
      "name": "cooldownActive",
      "msg": "Transfer cooldown is still active for this Bro."
    },
    {
      "code": 6015,
      "name": "invalidRescueFee",
      "msg": "Invalid rescue fee."
    },
    {
      "code": 6016,
      "name": "selfRescue",
      "msg": "You cannot rescue your own Bro."
    },
    {
      "code": 6017,
      "name": "notBurned",
      "msg": "This Bro is not in the graveyard."
    },
    {
      "code": 6018,
      "name": "overflow",
      "msg": "Arithmetic overflow."
    },
    {
      "code": 6019,
      "name": "unauthorized",
      "msg": "Unauthorized."
    },
    {
      "code": 6020,
      "name": "maxSupply",
      "msg": "Max supply reached."
    },
    {
      "code": 6021,
      "name": "spinNotStale",
      "msg": "Spin is not stale yet."
    },
    {
      "code": 6022,
      "name": "invalidConfig",
      "msg": "Invalid configuration value."
    },
    {
      "code": 6023,
      "name": "invalidAsset",
      "msg": "Asset is not a Bro from this collection or is not owned correctly."
    },
    {
      "code": 6024,
      "name": "collectionAlreadySet",
      "msg": "Collection already created."
    },
    {
      "code": 6025,
      "name": "collectionNotSet",
      "msg": "Collection not created yet."
    },
    {
      "code": 6026,
      "name": "invalidHolding",
      "msg": "Holding index out of range."
    },
    {
      "code": 6027,
      "name": "stringTooLong",
      "msg": "Name or uri too long."
    },
    {
      "code": 6028,
      "name": "invalidVaultAccount",
      "msg": "Invalid vault token account."
    },
    {
      "code": 6029,
      "name": "invalidAmount",
      "msg": "Invalid amount."
    },
    {
      "code": 6030,
      "name": "noPendingAuthority",
      "msg": "No pending authority proposal."
    },
    {
      "code": 6031,
      "name": "priceNotSet",
      "msg": "The TMB price has not been set yet."
    },
    {
      "code": 6032,
      "name": "missingAccounts",
      "msg": "A required account (prize vault or bonus asset) was not supplied."
    }
  ],
  "types": [
    {
      "name": "authorityAccepted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "previous",
            "type": "pubkey"
          },
          {
            "name": "newAuthority",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "authorityProposed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "current",
            "type": "pubkey"
          },
          {
            "name": "proposed",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "broDeposited",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "asset",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "lossStreak",
            "type": "u8"
          },
          {
            "name": "eligibleSlot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "broMinted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "asset",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "priceLamports",
            "type": "u64"
          },
          {
            "name": "startingBalance",
            "type": "u64"
          },
          {
            "name": "bonus",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "broRecord",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "asset",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "lossStreak",
            "type": "u8"
          },
          {
            "name": "tmbBalance",
            "type": "u64"
          },
          {
            "name": "holdings",
            "type": {
              "vec": {
                "defined": {
                  "name": "holding"
                }
              }
            }
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "broStatus"
              }
            }
          },
          {
            "name": "inEscrow",
            "type": "bool"
          },
          {
            "name": "pendingSpin",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "totalSpins",
            "type": "u32"
          },
          {
            "name": "eligibleSlot",
            "docs": [
              "Slot before which this (asset, owner) record may not spin (transfer cooldown)."
            ],
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "broStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "active"
          },
          {
            "name": "burned"
          }
        ]
      }
    },
    {
      "name": "broWithdrawn",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "asset",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "lossStreak",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "collectionCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "collection",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "config",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "pendingAuthority",
            "type": "pubkey"
          },
          {
            "name": "rewardWallet",
            "type": "pubkey"
          },
          {
            "name": "pauser",
            "type": "pubkey"
          },
          {
            "name": "tmbMint",
            "type": "pubkey"
          },
          {
            "name": "collection",
            "type": "pubkey"
          },
          {
            "name": "treasury",
            "type": "pubkey"
          },
          {
            "name": "teamWallet",
            "type": "pubkey"
          },
          {
            "name": "paused",
            "type": "bool"
          },
          {
            "name": "burnAtLossStreak",
            "type": "u8"
          },
          {
            "name": "spinAmounts",
            "type": {
              "array": [
                "u64",
                4
              ]
            }
          },
          {
            "name": "oddsBps",
            "type": {
              "array": [
                "u16",
                4
              ]
            }
          },
          {
            "name": "thresholds",
            "type": {
              "defined": {
                "name": "thresholds"
              }
            }
          },
          {
            "name": "rescueBurnBps",
            "type": "u16"
          },
          {
            "name": "rescueFeeOptions",
            "type": {
              "array": [
                "u64",
                4
              ]
            }
          },
          {
            "name": "maxPayoutBps",
            "type": "u16"
          },
          {
            "name": "minReserve",
            "type": "u64"
          },
          {
            "name": "mintPriceLamports",
            "type": "u64"
          },
          {
            "name": "mintPoolShareBps",
            "type": "u16"
          },
          {
            "name": "mintStartingBalance",
            "type": "u64"
          },
          {
            "name": "maxSupply",
            "type": "u32"
          },
          {
            "name": "minted",
            "type": "u32"
          },
          {
            "name": "transferCooldownSlots",
            "type": "u64"
          },
          {
            "name": "staleSlots",
            "type": "u64"
          },
          {
            "name": "totalUserTmb",
            "docs": [
              "Sum of every BroRecord.tmb_balance. Reward pool = vault TMB - total_user_tmb."
            ],
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "vaultBump",
            "type": "u8"
          },
          {
            "name": "escrowAuthBump",
            "type": "u8"
          },
          {
            "name": "prizesReady",
            "docs": [
              "False while a multi-transaction prize update is in flight (or after a failed one): spins are",
              "blocked until `set_prizes(.., finalize = true)` validates the complete table."
            ],
            "type": "bool"
          },
          {
            "name": "bonusUri",
            "docs": [
              "Metadata uri for Bonus Bro mints. Empty = copy the escrowed Bro's uri."
            ],
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "configArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "rewardWallet",
            "type": "pubkey"
          },
          {
            "name": "pauser",
            "type": "pubkey"
          },
          {
            "name": "treasury",
            "type": "pubkey"
          },
          {
            "name": "teamWallet",
            "type": "pubkey"
          },
          {
            "name": "burnAtLossStreak",
            "type": "u8"
          },
          {
            "name": "spinAmounts",
            "type": {
              "array": [
                "u64",
                4
              ]
            }
          },
          {
            "name": "oddsBps",
            "type": {
              "array": [
                "u16",
                4
              ]
            }
          },
          {
            "name": "thresholds",
            "type": {
              "defined": {
                "name": "thresholds"
              }
            }
          },
          {
            "name": "rescueBurnBps",
            "type": "u16"
          },
          {
            "name": "rescueFeeOptions",
            "type": {
              "array": [
                "u64",
                4
              ]
            }
          },
          {
            "name": "maxPayoutBps",
            "type": "u16"
          },
          {
            "name": "minReserve",
            "type": "u64"
          },
          {
            "name": "mintPriceLamports",
            "type": "u64"
          },
          {
            "name": "mintPoolShareBps",
            "type": "u16"
          },
          {
            "name": "mintStartingBalance",
            "type": "u64"
          },
          {
            "name": "maxSupply",
            "type": "u32"
          },
          {
            "name": "transferCooldownSlots",
            "type": "u64"
          },
          {
            "name": "staleSlots",
            "type": "u64"
          },
          {
            "name": "bonusUri",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "configInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "tmbMint",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "configUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "by",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "escrowReceipt",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "asset",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "depositedAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "graveyard",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "asset",
            "type": "pubkey"
          },
          {
            "name": "lastOwner",
            "type": "pubkey"
          },
          {
            "name": "burnedAt",
            "type": "i64"
          },
          {
            "name": "metadataUri",
            "type": "string"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "holding",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "usdValueSnapshot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "holdingClaimed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "asset",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "pausedChanged",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "paused",
            "type": "bool"
          },
          {
            "name": "by",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "prize",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "id",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "kind",
            "type": {
              "defined": {
                "name": "prizeKind"
              }
            }
          },
          {
            "name": "label",
            "type": {
              "array": [
                "u8",
                24
              ]
            }
          },
          {
            "name": "amount",
            "docs": [
              "TMB base units (Tmb), token base units (Token), count (BonusBro)."
            ],
            "type": "u64"
          },
          {
            "name": "mint",
            "docs": [
              "Prize token mint (Token only)."
            ],
            "type": "pubkey"
          },
          {
            "name": "weight",
            "type": "u32"
          },
          {
            "name": "usdValue",
            "docs": [
              "USD value snapshot (Token only), same units as `Thresholds::stock_value_low`."
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "prizeKind",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "none"
          },
          {
            "name": "tmb"
          },
          {
            "name": "token"
          },
          {
            "name": "bonusBro"
          }
        ]
      }
    },
    {
      "name": "prizeTable",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "entries",
            "type": {
              "vec": {
                "defined": {
                  "name": "prize"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "prizesSet",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "count",
            "type": "u8"
          },
          {
            "name": "by",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "rescued",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "burnedAsset",
            "type": "pubkey"
          },
          {
            "name": "newAsset",
            "type": "pubkey"
          },
          {
            "name": "rescuer",
            "type": "pubkey"
          },
          {
            "name": "rescuerAsset",
            "type": "pubkey"
          },
          {
            "name": "lastOwner",
            "type": "pubkey"
          },
          {
            "name": "fee",
            "type": "u64"
          },
          {
            "name": "burnedAmount",
            "type": "u64"
          },
          {
            "name": "treasuryAmount",
            "docs": [
              "TMB sent to the treasury wallet (25% by default)"
            ],
            "type": "u64"
          },
          {
            "name": "ownerAmount",
            "docs": [
              "TMB sent to the wallet that lost the Bro (25% by default)"
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "rolesUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "rewardWallet",
            "type": "pubkey"
          },
          {
            "name": "pauser",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "spinRequest",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "asset",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "oddsTier",
            "type": "u8"
          },
          {
            "name": "randomnessAccount",
            "type": "pubkey"
          },
          {
            "name": "commitSlot",
            "docs": [
              "Switchboard `seed_slot` the randomness was committed to."
            ],
            "type": "u64"
          },
          {
            "name": "requestedSlot",
            "type": "u64"
          },
          {
            "name": "nonce",
            "type": "u32"
          },
          {
            "name": "atStake",
            "type": "bool"
          },
          {
            "name": "resolved",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "spinRequested",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "asset",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "oddsTier",
            "type": "u8"
          },
          {
            "name": "commitSlot",
            "type": "u64"
          },
          {
            "name": "lossStreak",
            "type": "u8"
          },
          {
            "name": "atStake",
            "docs": [
              "True when a loss on this spin burns the Bro."
            ],
            "type": "bool"
          },
          {
            "name": "randomnessAccount",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "spinSettled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "asset",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "oddsTier",
            "type": "u8"
          },
          {
            "name": "outcome",
            "docs": [
              "0 loss, 1 win, 2 stale-cancel loss"
            ],
            "type": "u8"
          },
          {
            "name": "wedgeIndex",
            "type": "u8"
          },
          {
            "name": "prizeId",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "prizeKind",
            "type": "u8"
          },
          {
            "name": "prizeAmount",
            "type": "u64"
          },
          {
            "name": "newStreak",
            "type": "u8"
          },
          {
            "name": "burned",
            "type": "bool"
          },
          {
            "name": "newBalance",
            "type": "u64"
          },
          {
            "name": "bonusAsset",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "thresholds",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "lowTmb",
            "type": "u64"
          },
          {
            "name": "mediumTmb",
            "type": "u64"
          },
          {
            "name": "highTmb",
            "type": "u64"
          },
          {
            "name": "stockCountLow",
            "type": "u8"
          },
          {
            "name": "stockValueLow",
            "type": "u64"
          },
          {
            "name": "stockTmbHigh",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "tmbBought",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "asset",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "lamportsPaid",
            "type": "u64"
          },
          {
            "name": "newBalance",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "tmbDeposited",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "asset",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "newBalance",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "tmbPrice",
      "docs": [
        "SOL price of TMB, kept in its own account so the (already deployed) Config layout is untouched."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "lamportsPerTmb",
            "docs": [
              "Lamports per ONE whole TMB (10^decimals base units)."
            ],
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "tmbPriceSet",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "lamportsPerTmb",
            "type": "u64"
          },
          {
            "name": "by",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "tmbWithdrawn",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "asset",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "newBalance",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "updateConfigArgs",
      "docs": [
        "Every field optional; only `Some` fields are applied. Roles use `set_roles`, authority uses",
        "propose/accept, pause uses `set_paused`, mint/collection are immutable after setup."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "treasury",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "teamWallet",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "burnAtLossStreak",
            "type": {
              "option": "u8"
            }
          },
          {
            "name": "spinAmounts",
            "type": {
              "option": {
                "array": [
                  "u64",
                  4
                ]
              }
            }
          },
          {
            "name": "oddsBps",
            "type": {
              "option": {
                "array": [
                  "u16",
                  4
                ]
              }
            }
          },
          {
            "name": "thresholds",
            "type": {
              "option": {
                "defined": {
                  "name": "thresholds"
                }
              }
            }
          },
          {
            "name": "rescueBurnBps",
            "type": {
              "option": "u16"
            }
          },
          {
            "name": "rescueFeeOptions",
            "type": {
              "option": {
                "array": [
                  "u64",
                  4
                ]
              }
            }
          },
          {
            "name": "maxPayoutBps",
            "type": {
              "option": "u16"
            }
          },
          {
            "name": "minReserve",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "mintPriceLamports",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "mintPoolShareBps",
            "type": {
              "option": "u16"
            }
          },
          {
            "name": "mintStartingBalance",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "maxSupply",
            "type": {
              "option": "u32"
            }
          },
          {
            "name": "transferCooldownSlots",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "staleSlots",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "bonusUri",
            "type": {
              "option": "string"
            }
          }
        ]
      }
    },
    {
      "name": "vaultFunded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "by",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "vaultWithdrawn",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "by",
            "type": "pubkey"
          }
        ]
      }
    }
  ]
};
