import type { Browser, BrowserContext, Page } from "@playwright/test";
import type { TestUser } from "./user";
import { ProfilePage } from "../Pages/profile-page";
import { BookingPage } from "../Pages/booking-page";
import { HeaderPage } from "../Pages/header-page";
import { MySlotsPage } from "../Pages/my-slots-page";

export type Screens = {
  page: Page;
  profile: ProfilePage;
  slots: MySlotsPage;
  booking: BookingPage;
  header: HeaderPage;
};

export type Participant = Screens & {
  user: TestUser;
};

function screens(page: Page): Screens {
  return {
    page,
    profile: new ProfilePage(page),
    slots: new MySlotsPage(page),
    booking: new BookingPage(page),
    header: new HeaderPage(page),
  };
}

async function openContext(browser: Browser, contexts: BrowserContext[]): Promise<Page> {
  const context = await browser.newContext();
  contexts.push(context);
  return context.newPage();
}

export async function openParticipant(
  browser: Browser,
  accountContexts: BrowserContext[],
  user: TestUser,
): Promise<Participant> {
  const page = await openContext(browser, accountContexts);
  return { user, ...screens(page) };
}

export async function openGuest(browser: Browser, contexts: BrowserContext[]): Promise<Screens> {
  const page = await openContext(browser, contexts);
  return screens(page);
}
