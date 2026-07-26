import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../services/auth-service';
import { FakeAuthService } from '../../services/testing/fake-auth-service';
import { Home } from './home';

// FakeAuthService is always "signed in" — a small mutable stand-in covers
// the signed-out case instead, since Home only ever calls
// .uid()/.ready()/.continueAsGuest() on the service (same duck-typed shape
// FakeAuthService itself relies on) — continueAsGuest flips uid() truthy,
// mirroring how the real AuthService's signal flips once
// signInAnonymously resolves.
class SignedOutAuthService {
  private signedIn = false;

  uid(): string | null {
    return this.signedIn ? 'guest-uid' : null;
  }
  ready(): Promise<void> {
    return Promise.resolve();
  }
  continueAsGuest(): Promise<void> {
    this.signedIn = true;
    return Promise.resolve();
  }
}

describe('Home', () => {
  async function createComponent(authService: unknown): Promise<ComponentFixture<Home>> {
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [provideRouter([]), { provide: AuthService, useValue: authService }],
    }).compileComponents();

    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();
    return fixture;
  }

  it('should create', async () => {
    const fixture = await createComponent(new FakeAuthService());
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the Roll4 title and About/Upcoming Features sections regardless of sign-in state', async () => {
    const fixture = await createComponent(new SignedOutAuthService());
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.app-title')?.textContent).toContain('Roll4');
    expect(compiled.querySelector('.about h2')?.textContent).toContain('About');
    expect(compiled.querySelector('.upcoming h2')?.textContent).toContain('Upcoming Features');
  });

  it('prompts a signed-out visitor to sign in, with no quick-nav links into the app', async () => {
    const fixture = await createComponent(new SignedOutAuthService());
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.signin-prompt')).toBeTruthy();
    expect(compiled.querySelector('.quick-nav')).toBeFalsy();
  });

  it('shows a signed-in GM quick-nav links into the app, with no sign-in prompt', async () => {
    const fixture = await createComponent(new FakeAuthService());
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.quick-nav')).toBeTruthy();
    expect(compiled.querySelector('.signin-prompt')).toBeFalsy();
  });

  it('warns a signed-out visitor before letting them continue as a guest, and swaps in the quick-nav once they do', async () => {
    const fixture = await createComponent(new SignedOutAuthService());
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.guest-warning')?.textContent).toContain(
      'saved only to this browser',
    );

    compiled.querySelector<HTMLButtonElement>('.signin-prompt .guest-btn')?.click();
    await fixture.whenStable();

    expect(compiled.querySelector('.quick-nav')).toBeTruthy();
    expect(compiled.querySelector('.signin-prompt')).toBeFalsy();
  });
});
