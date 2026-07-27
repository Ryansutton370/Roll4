import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** One card on this landing page — a link to one of the sub-pages under /generators, plus a one-line blurb. */
interface GeneratorCard {
  /** The route segment under /generators (e.g. 'names' → /generators/names), not a full path — the template builds the absolute link. */
  path: string;
  title: string;
  description: string;
}

/**
 * The Content & Generators tab's own landing page, at '/generators' (see
 * app.routes.ts) — GeneratorsShell's default child route, same "index page
 * inside a shell" shape as PlayerRoster/NpcRoster default under
 * PlayersShell/NpcsShell. Used to be NameGenerator itself (the Names page
 * defaulted to living at the bare '/generators' path); moved to its own
 * '/generators/names' route once there were six sub-pages and a plain
 * "pick one" hub made more sense than defaulting to whichever one shipped
 * first. Static content, no store — same shape as Home's own quick-nav
 * grid (reuses its .quick-nav/.quick-nav-card classes, promoted to
 * styles.css for exactly this second use).
 */
@Component({
  selector: 'app-generators-home',
  imports: [RouterLink],
  templateUrl: './generators-home.html',
  styleUrl: './generators-home.css',
})
export class GeneratorsHome {
  protected readonly cards: GeneratorCard[] = [
    {
      path: 'names',
      title: 'Names',
      description: 'Get names spanning many settings and categories.',
    },
    {
      path: 'encounter',
      title: 'Encounter',
      description: 'Generate a monster roster from the D&D 5e SRD or Shadowdark compendiums.',
    },
    {
      path: 'wild-magic',
      title: 'Wild Magic',
      description: 'Roll a wild-magic mishap on the Chaos Burst tables.',
    },
    {
      path: 'treasure',
      title: 'Treasure',
      description: 'Roll Trinkets, Wondrous Items, and Potions.',
    },
    {
      path: 'combat-thesaurus',
      title: 'Combat Thesaurus',
      description: 'Roll a flavor verb for narrating an attack.',
    },
    {
      path: 'spells',
      title: 'Spell Lists',
      description: 'Browse or roll D&D 5e SRD and Shadowdark spells.',
    },
    {
      path: 'quests-rumors-gossip',
      title: 'Quests, Rumors and Gossip',
      description: 'Roll a prompt to spark quests, rumors, or downtime roleplay.',
    },
  ];
}
