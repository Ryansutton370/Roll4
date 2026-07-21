import {
  Component,
  ElementRef,
  SecurityContext,
  effect,
  inject,
  model,
  viewChild,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

/**
 * "Does this Notes value actually have anything in it?" — used wherever a
 * combatant's notes drive a visual state (the bubble's Notes icon color/
 * hint text, CombatantFields' collapsed toggle label) now that notes are
 * rich-text HTML instead of a plain string, so `notes === ''` alone isn't
 * enough (an editor that's been typed into and cleared can leave behind
 * `<p><br></p>` or similar, not a truly empty string). A blunt tag-strip
 * rather than parsing real HTML — fine for "is there any real content,"
 * which is all this needs to answer.
 */
export function hasRichTextContent(html: string): boolean {
  return (
    html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim().length > 0
  );
}

/**
 * A deliberately minimal rich-text editor — bold/italic/underline plus
 * bullet/numbered lists, nothing else. Built on `contenteditable` +
 * `document.execCommand`, not a library: `execCommand` is long-deprecated
 * but still supported by every current browser, and remains the simplest
 * way to get "the browser's own text-editing commands" without writing a
 * Selection/Range-based command layer from scratch — a reasonable trade for
 * an editor this small in scope. If browsers ever actually remove it, this
 * is the one place that would need rewriting.
 *
 * Used two ways: embedded inline (CombatantFields' expandable Notes field,
 * which — since EditCombatantDialog is just CombatantFields in a dialog —
 * covers Player/NPC create forms, ad-hoc combatant forms, and the Edit
 * dialog all at once) and inside NotesDialog's own popout, opened from the
 * combatant bubble's Notes icon.
 */
@Component({
  selector: 'app-rich-text-editor',
  templateUrl: './rich-text-editor.html',
  styleUrl: './rich-text-editor.css',
})
export class RichTextEditor {
  private readonly sanitizer = inject(DomSanitizer);

  // model(): same two-way-binding primitive CombatantFields' fields use —
  // `[value]="notes()" (valueChange)="notes.set($event)"` at every call
  // site, for the same one-consistent-binding-style reason documented on
  // CombatantFields.name.
  readonly value = model.required<string>();

  private readonly editableEl = viewChild.required<ElementRef<HTMLDivElement>>('editable');

  // effect(): keeps the contenteditable <div> in sync with `value()` from
  // the OUTSIDE (e.g. NotesDialog's openFor() setting a different
  // combatant's notes) — but only while the div isn't focused. Without that
  // guard, every keystroke would round-trip: typing fires (input) ->
  // onInput() below calls value.set(...) -> this effect reads the new
  // value() -> writes it straight back into innerHTML -> the browser loses
  // the cursor position mid-word. Setting innerHTML imperatively (not via
  // an Angular [innerHTML] template binding) means Angular's automatic
  // sanitization doesn't run here for free, so it's done by hand via
  // DomSanitizer — this is the one place a combatant's notes ever become
  // live HTML in the DOM, so it's the one place that has to guard against
  // it (a corrupted or hand-edited localStorage value shouldn't be able to
  // run script just by opening this editor).
  constructor() {
    effect(() => {
      const html = this.value();
      const el = this.editableEl().nativeElement;
      if (document.activeElement !== el) {
        el.innerHTML = this.sanitizer.sanitize(SecurityContext.HTML, html) ?? '';
      }
    });
  }

  protected onInput(): void {
    this.value.set(this.editableEl().nativeElement.innerHTML);
  }

  // mousedown's preventDefault (see the template) stops the browser from
  // shifting focus off the contenteditable <div> and onto the toolbar
  // button before this click handler runs — execCommand acts on whatever
  // is currently focused/selected, so losing focus first would make every
  // button a no-op the first time and only ever affect whatever was
  // selected the *previous* time the div had focus.
  protected exec(command: string): void {
    document.execCommand(command);
    this.editableEl().nativeElement.focus();
  }
}
