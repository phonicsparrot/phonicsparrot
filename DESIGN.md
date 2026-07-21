# Design System - Phonics Parrot Kid-Friendly 3D Comic System

This document outlines the kid-friendly Cartoon Playground flat-3D design system created for Phonics Parrot.

---

## 1. Color Palette

| Token | CSS Hex | Purpose |
|-------|---------|---------|
| **Primary Text** | `#1e293b` | General readability and outlines |
| **Secondary Text** | `#475569` | Helper labels, captions, and details |
| **Background Sky** | `#bae6fd` | Top section of the cartoon sky gradient |
| **Background Mid** | `#e0f2fe` | Mid section of the sky gradient |
| **Background Sun** | `#fef9c3` | Bottom section of the sky gradient (warm sun glow) |
| **Builder Pink** | `#e94560` | Accent and details for Flashcard Builder |
| **Speak Blue** | `#4361ee` | Accent and details for Poem Builder |
| **Reader Teal** | `#2ec4b6` | Accent and details for Line Reader |
| **Pong Orange** | `#ff7b00` | Accent and details for Phonics Pong |

---

## 2. Typography

- **Font Family**: `"Fredoka", "Segoe UI", system-ui, sans-serif`
- **Characteristics**: Rounded strokes, highly legible, playful, soft, perfect for primary education.
- **Title Size**: `3rem` to `4rem` for hero/start headers, bold weights (`900` or `800`) with comic borders.
- **Card Header Size**: `1.6rem` to `1.7rem`, bold (`700`).
- **Body Text**: `1.05rem` to `1.15rem`, high-contrast for projector visibility.

---

## 3. Flat-3D Cartoon Cards

- **Base Styling**:
  ```css
  background: rgba(255, 255, 255, 0.95);
  border: 3.5px solid #1e293b;
  border-radius: 24px;
  color: #1e293b;
  box-shadow: 0 10px 0 #1e293b, 0 20px 30px rgba(30, 41, 59, 0.08);
  ```
- **Hover Lift**:
  ```css
  transform: translateY(-4px) scale(1.015);
  box-shadow: 0 14px 0 #1e293b, 0 25px 35px rgba(30, 41, 59, 0.12);
  ```
- **Click Compression**:
  ```css
  transform: translateY(4px);
  box-shadow: 0 2px 0 #1e293b;
  ```

---

## 4. Bubbly 3D Tactile Buttons

- **Base Styling**:
  ```css
  font-family: "Fredoka", sans-serif;
  font-weight: 700;
  border: 3.5px solid #1e293b;
  border-radius: 18px;
  box-shadow: 0 6px 0 #1e293b;
  background: #ff7b00;
  color: #fff;
  cursor: pointer;
  ```
- **Hover Lift**:
  ```css
  transform: translateY(-2px);
  box-shadow: 0 8px 0 #1e293b;
  filter: brightness(1.05);
  ```
- **Active Click**:
  ```css
  transform: translateY(4px);
  box-shadow: 0 2px 0 #1e293b;
  ```

---

## 5. Background Elements

- **Drifting Clouds**: Slow, horizontal, CSS-only clouds in the viewport margins to make the classroom screen dynamic.
- **Soap Bubbles (Motes)**: Translucent, rising circles to add a playful feel.
- **Bubble Emojis**: Emojis scattered around inside circular white boxes with borders and shadows.
- **Custom Modals**: Dialog boxes with the parrot mascot `🦜` and speech bubbles for alerts/permission queries instead of blocking browser dialogs.
