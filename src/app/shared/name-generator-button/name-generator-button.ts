import {
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NameTableStore } from '../../services/name-table-store';

/**
 * A 🎲 button + set/table picker popover that rolls a name from
 * NameTableStore and reports it via `nameSelected` — deliberately doesn't
 * own a text input itself, so it can sit next to *any* name-ish field
 * (CombatantFields' Name field, the Encounter Generator's per-row personal
 * name) without needing to know that field's placeholder/styling/what
 * "submit" means there. The parent listens for `nameSelected` and decides
 * what to do with it — same "child reports, parent decides" separation as
 * CombatantBubble's outputs.
 *
 * Extracted out of CombatantFields once the Encounter Generator's roster
 * needed the same picker per-row, alongside its existing bulk "Generate
 * Names" pass — duplicating this popover's logic a second time wasn't
 * worth it once there were two call sites.
 */
@Component({
  selector: 'app-name-generator-button',
  imports: [FormsModule],
  templateUrl: './name-generator-button.html',
  styleUrl: './name-generator-button.css',
})
export class NameGeneratorButton {
  protected readonly nameTableStore = inject(NameTableStore);

  readonly nameSelected = output<string>();

  protected readonly open = signal(false);
  protected readonly selectedSetName = signal<string | null>(null);
  protected readonly selectedTableId = signal<string | null>(null);
  protected readonly rolledNames = signal<string[]>([]);

  protected readonly tablesForSelectedSet = computed(() => {
    const setName = this.selectedSetName();
    return setName ? this.nameTableStore.tablesForSet(setName) : [];
  });

  // viewChild + HostListener('document:click'): the same "collapse on
  // click away" pattern as CombatantBubble's HP-adjust/notes popovers.
  private readonly triggerBtn = viewChild<ElementRef<HTMLButtonElement>>('triggerBtn');
  private readonly popoverEl = viewChild<ElementRef<HTMLElement>>('popover');

  // position: fixed, computed here rather than CSS `top/right: ...` anchored
  // to the button (see name-generator-button.css) — verified live (opening
  // this from CombatantFields inside AddCombatantDialog, a native <dialog>)
  // that a plain CSS anchor breaks inside any scroll/clip container smaller
  // than the popover's own would-be extent: <dialog> has a browser-default
  // `overflow: auto`, which doesn't just hide the overflowing part — it
  // silently scrolls it out of the dialog's own clipped viewport, so the
  // popover was still in the DOM and still *visually* partly rendered, but
  // un-clickable (a real click landed on the dialog element itself, past
  // the popover's clipped edge). `position: fixed` sidesteps this
  // entirely: a fixed-position element's containing block is the viewport
  // itself (there's no `transform`/similar on any ancestor here to change
  // that), so no ancestor's `overflow` — the dialog's or anyone else's —
  // can clip or scroll it away. Clamping the computed coordinates against
  // window.innerWidth/innerHeight below is what then keeps it fully
  // visible regardless of where the trigger button sits: hard against a
  // narrow dialog's edge, at the bottom of a long roster list, anywhere.
  protected readonly popoverTop = signal(0);
  protected readonly popoverLeft = signal(0);

  // requestAnimationFrame, not a direct call: verified live that effect()'s
  // callback can fire with the *new* rolledNames() value before Angular has
  // actually patched the results list into the DOM, so measuring the
  // popover's size here would catch its pre-roll (shorter) height and
  // undershoot. rAF runs after that render has committed and laid out.
  constructor() {
    effect(() => {
      const isOpen = this.open();
      this.rolledNames();
      if (isOpen) {
        requestAnimationFrame(() => this.positionPopover());
      }
    });
  }

  private positionPopover(): void {
    const button = this.triggerBtn()?.nativeElement;
    const popover = this.popoverEl()?.nativeElement;
    if (!button || !popover) return;

    const buttonRect = button.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    const margin = 8;

    // Right-aligned under the button by default (matches how it always
    // looked pre-fix), but clamped into [margin, viewport edge - margin]
    // on both axes so it can never render partly or fully off-screen.
    const left = Math.min(
      Math.max(buttonRect.right - popoverRect.width, margin),
      window.innerWidth - popoverRect.width - margin,
    );
    const top = Math.min(
      Math.max(buttonRect.bottom + 4, margin),
      window.innerHeight - popoverRect.height - margin,
    );
    this.popoverLeft.set(left);
    this.popoverTop.set(top);
  }

  @HostListener('document:click', ['$event'])
  protected collapseOnClickAway(event: MouseEvent): void {
    if (!this.open()) return;
    const el = this.popoverEl()?.nativeElement;
    if (el && !el.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  protected toggle(): void {
    const opening = !this.open();
    this.open.set(opening);
    if (opening && this.selectedSetName() === null) {
      this.selectSet(this.nameTableStore.setNames()[0] ?? null);
    }
  }

  protected selectSet(setName: string | null): void {
    this.selectedSetName.set(setName);
    const firstTable = setName ? this.nameTableStore.tablesForSet(setName)[0] : undefined;
    this.selectedTableId.set(firstTable?.id ?? null);
    this.rolledNames.set([]);
  }

  protected selectTable(tableId: string): void {
    this.selectedTableId.set(tableId);
    this.rolledNames.set([]);
  }

  protected roll(): void {
    const tableId = this.selectedTableId();
    if (!tableId) return;
    this.rolledNames.set(this.nameTableStore.rollNames(tableId, 6));
  }

  protected pick(candidate: string): void {
    this.nameSelected.emit(candidate);
    this.open.set(false);
  }
}
