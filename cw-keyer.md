# CW Paddle → USB Adapter — Findings

Investigation of a Morse paddle (3.5mm jack) → USB adapter, based on what macOS
reports over USB/HID plus web research. Date: 2026-06-20.

## TL;DR

- **Maker / OEM:** **PCSensor** (Chinese OEM; owns USB vendor ID `0x413D`, also makes
  the "TEMPer" sensors). Closed-source firmware.
- **Product class:** the generic commercial **"Morse Code Key → USB" / VBand dongle**
  sold all over AliExpress/Amazon and by shops like cwmorse.us. **Not** one of the
  open-source GitHub projects.
- **Firmware:** proprietary, **no public source exists**. Open-source *equivalents*
  exist for DIY boards (see below).

## What the device is

A composite USB-HID device that presents **both a mouse and a keyboard** at once.
The paddles drive one or the other depending on the selected mode.

### USB identity (from `ioreg` / `hidutil` on macOS)

| Field            | Value                          |
|------------------|--------------------------------|
| idVendor         | `16701` = `0x413D` (PCSensor)  |
| idProduct        | `8455`  = `0x2107`             |
| iProduct string  | `0` (none)                     |
| Manufacturer str | none                           |
| VersionNumber    | `0`                            |
| bDeviceClass     | `0` (class defined per-interface) |

`hidutil list` showed two HID collections under the same VID:PID:

- Usage Page `1` / Usage `2` → **Mouse**
- Usage Page `1` / Usage `6` → **Keyboard**

### HID report descriptors (raw)

**Mouse collection:**
```
05010902a1010901a1000509190129031500250175019503810275059501810105010930093109381581257f750895038106c0c0
```
Decodes to the textbook **3-button relative mouse** with X / Y / Wheel, deltas
−127..127 (`15 81` … `25 7f`).

**Keyboard collection:**
```
05010906a101050719e029e7150025017501950881029501750881019503750105081901290391029505750191019506750826ff000507190029918100c0
```
Decodes to the canonical **boot-protocol keyboard**: 8 modifier bits + 1 reserved
byte + 3 LED output bits (+5 pad) + a 6-byte key-array (usages `0x00`–`0x91`).

Both are the standard "example" descriptors — no vendor-specific usage pages, no
strings, version 0. That string-less/stock-descriptor profile is the fingerprint of
a **closed-source commercial dongle**, not a hobby build (hobby firmware on
TinyUSB/CircuitPython/Arduino almost always sets descriptive strings + a custom VID).

## Observed behavior

Two modes, selected at power-up and indicated by the onboard LED:

| LED state    | Mode          | Paddles do                       |
|--------------|---------------|----------------------------------|
| **off**      | Mouse mode    | mouse buttons / mouse actions    |
| **flashing** | Keyboard mode | send keyboard `[` and `]`        |

### The little onboard button

It has **two distinct jobs**:

1. **At power-up (held) → mode selector.** Hold the button down *while plugging the
   device in* to toggle the persisted mode (mouse ↔ keyboard). The mode is latched at
   boot, which is why a normal tap during use can't switch it.
2. **During normal use → an extra mouse input.** In **mouse mode**, pressing the
   button makes the **cursor move downward** (the firmware emits a stream of mouse
   +Y movement reports while held — it injects motion deltas, not click/button
   events). In **keyboard mode** the button does **nothing**, because it is only
   wired into the mouse report, not the keyboard report.

   This "press = move the pointer" behavior is the classic **mouse-jiggler /
   keep-awake** trick (stops the screen sleeping during long listening/practice
   sessions). The downward direction isn't meaningful — it's just the axis the
   firmware picked.

### Why `[` and `]` keyboard mode

Those bracket keys are what the browser-based CW trainers in the VBand / Vail /
morsecode.me family listen for. So: **keyboard mode = for web CW practice sites**,
**mouse mode = for sites/tools that read mouse input** (or just the keep-awake use).

## Identification reasoning

- VID `0x413D` is registered to **PCSensor** per the the-sz.com USB-ID database →
  pins the OEM definitively.
- The dual mouse+keyboard HID, default mouse mode, hold-button-on-plug to flip to a
  `[`/`]` keyboard mode, and an LED that flashes in keyboard mode — that exact
  behavior matches the cheap commercial "Morse Code Key → USB" dongle (cwmorse.us /
  AliExpress / Amazon).
- It is **NOT** one of the open-source projects, because those use different MCUs and
  therefore different VIDs:
  - Vail-CW/vail-adapter — SAMD/QT-Py → Adafruit VID
  - grahamwhaley/pico_vband, ncw/vband — Raspberry Pi Pico → VID `0x2E8A`
  - farmergreg/vband-teensy-morse-code — Teensy → VID `0x16C0`
- **Caveat:** the OEM (PCSensor) and product class are certain; the exact reseller
  branding is not, since the board carries no identifying USB strings.

## Firmware

**No published source for this exact device — it's closed PCSensor firmware.**
Searched PCSensor, cwmorse.us, GitHub, Hackaday, and RE writeups; nothing matches.

Realistic options:

1. **Open-source firmware for equivalent boards** (won't flash onto this unit as-is,
   but is the reference / a path to a hackable replacement):
   - https://github.com/Vail-CW/vail-adapter — most complete (all Vail keyer modes)
   - https://github.com/grahamwhaley/pico_vband — RP2040 / Pico
   - https://github.com/ncw/vband — RP2040 / Pico
   - https://github.com/farmergreg/vband-teensy-morse-code — Teensy

2. **Reverse-engineer / reflash this unit** — needs the MCU identity, which is not
   exposed over USB. Open the case and read the chip markings. PCSensor `0x413D`
   gadgets are very commonly **WCH CH552 / CH549** parts. If so, there's a full open
   toolchain:
   - https://github.com/wagiminator (CH55x tools + examples)
   - https://github.com/wagiminator/CH552-MouseWiggler (literally the "move mouse to
     keep awake" behavior this button shows)
   - Arduino CH55x core
   Note: the stock firmware may be read-protected and thus not dumpable; you'd be
   replacing it, not extracting it.

3. **Ask the seller** (cwmorse.us / the AliExpress listing) — occasionally has a
   flashing tool or basic docs; source unlikely.

## Useful commands (macOS) used here

```sh
# USB tree (vendor/product IDs)
ioreg -p IOUSB -l -w 0 | grep -iE '"(idProduct|idVendor|iProduct)"'

# HID collections for the device
hidutil list | grep -i '0x413d'

# Raw HID report descriptors
ioreg -c IOHIDDevice -r -l -w 0 | grep -iE 'ReportDescriptor|VendorID|ProductID'
```

## Open follow-ups

- Capture raw HID reports per mode to document exact byte output (precise keycodes
  for `[`/`]`, and confirm the button's mouse-Y deltas).
- Open the case → read MCU markings → match to open firmware + flashing procedure if
  a custom firmware is desired.

## Sources

- the-sz.com USB-ID database — VID `0x413D` = PCSensor:
  https://the-sz.com/products/usbid/index.php?v=0x413D
- cwmorse.us — Morse Code Key to USB:
  https://cwmorse.us/products/morse-code-key-to-usb
- Vail-CW/vail-adapter: https://github.com/Vail-CW/vail-adapter
- grahamwhaley/pico_vband: https://github.com/grahamwhaley/pico_vband
- ncw/vband: https://github.com/ncw/vband
- farmergreg/vband-teensy-morse-code: https://github.com/farmergreg/vband-teensy-morse-code
- wagiminator/CH552-MouseWiggler: https://github.com/wagiminator/CH552-MouseWiggler
