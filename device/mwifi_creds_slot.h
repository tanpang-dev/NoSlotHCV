/* Shared Wi-Fi creds-slot ABI.
 *
 * Used by BOTH:
 *   - the device blob (nds-bootstrap fork, GPLv3): place ONE instance of this
 *     struct in the blob image, with `magic` initialised to MWIFI_CREDS_MAGIC
 *     and ssid/pmk left zero. Read ssid (ssid_len bytes) + pmk at runtime
 *     instead of compile-time macros.
 *   - the PC key baker (server/lib/keybaker.js): find the magic in MWIFI.BIN
 *     and overwrite ssid_len/ssid/pmk with the user's values.
 *
 * Keep this layout in sync with keybaker.js. Total size: 76 bytes.
 */
#ifndef MWIFI_CREDS_SLOT_H
#define MWIFI_CREDS_SLOT_H

#include <stdint.h>

#define MWIFI_CREDS_MAGIC   "MWIFICR1"  /* 8 bytes, no NUL terminator stored */
#define MWIFI_CREDS_VERSION 1
#define MWIFI_SSID_MAX      32
#define MWIFI_PMK_LEN       32

typedef struct {
    char    magic[8];                 /* "MWIFICR1" */
    uint8_t version;                  /* MWIFI_CREDS_VERSION */
    uint8_t ssid_len;                 /* valid bytes in ssid[] (0..32) */
    uint8_t reserved[2];
    char    ssid[MWIFI_SSID_MAX];     /* raw SSID bytes, unused tail is zero */
    uint8_t pmk[MWIFI_PMK_LEN];       /* precomputed WPA PMK */
} mwifi_creds_slot_t;                 /* 8+1+1+2+32+32 = 76 bytes */

#endif /* MWIFI_CREDS_SLOT_H */
