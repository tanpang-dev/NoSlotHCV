# NOTICE / Credits

**NoSlotHCV is unofficial.** It is not affiliated with, endorsed by, or
sponsored by Sega, SEGA TOYS, or any rights holder of the works it can be used
with. All product names, trademarks, and registered trademarks are property of
their respective owners.

NoSlotHCV ships **no copyrighted card data** — no card images, no card stats,
and no real barcodes. It includes only a data *format* (`data/cards.schema.json`)
and fictional sample data. Users supply their own legally‑obtained data.

## This project (UI + server)

Licensed under the MIT License (see `LICENSE`).

## Device-side firmware (separate repository)

The on-device part is a fork of **nds-bootstrap**
(https://github.com/DS-Homebrew/nds-bootstrap), licensed under **GPLv3**.
It is distributed from its own repository together with its corresponding
source. The prebuilt `MWIFI.BIN` is a GPLv3 build artifact.

## Research & references

- HCV-1000 (Sega Card Reader) protocol research:
  shonumi, *Edge of Emulation: Sega Card Reader*
  (https://shonumi.github.io/articles/art21.html)

## Third-party components

- React, React-DOM — MIT
- Vite, @vitejs/plugin-react — MIT

Wi-Fi PMK derivation uses PBKDF2-HMAC-SHA1 (the standard WPA-PSK derivation)
via the Node.js standard library.
