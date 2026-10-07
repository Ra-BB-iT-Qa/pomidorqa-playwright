import { test, expect, type BrowserContext } from "@playwright/test";
import { TestUser, makeUser, registerUserViaApi, deleteUserViaApi, openBookingModal, cleanupUsersViaApi, ROUTES } from "../helpers/user";
import { openParticipant } from "../helpers/actor";
import { ProfilePage } from "../Pages/profile-page";
import { MySlotsPage } from "../Pages/my-slots-page";

test.describe("Навыки", () => {
  test.describe("в профиле", () => {
    let user: TestUser;
    let profilePage: ProfilePage;
    let mySlotsPage: MySlotsPage;

    test.beforeEach(async ({ page }) => {
      user = makeUser("Rex", Date.now());
      profilePage = new ProfilePage(page);
      mySlotsPage = new MySlotsPage(page);
      await registerUserViaApi(page, user);
      await page.goto(ROUTES.profile);
    });

    test.afterEach(async ({ page }) => {
      await deleteUserViaApi(page.context().request).catch((reason: unknown) => {
        const message = reason instanceof Error ? reason.message : String(reason);
        if (message.includes("401") || message.includes("404")) {
          return;
        }
        throw reason;
      });
    });

    test("навык «хочу разобрать» появляется в профиле", async () => {
      const skillTag = `Want-${Date.now()}`;

      await test.step("Хост: добавляет навык «хочу разобрать»", async () => {
        await profilePage.addSkill(skillTag, "want_to_learn");
        await profilePage.page.reload();
      });

      await test.step("Хост: видит навык только в разделе «хочу разобрать»", async () => {
        await expect(profilePage.wantToLearnSkill(skillTag)).toBeVisible();
        await expect(profilePage.canHelpSkill(skillTag)).toHaveCount(0);
      });
    });

    test("нельзя добавить второй такой же навык «хочу разобрать»", async () => {
      const skillTag = `Want-${Date.now()}`;

      await test.step("Хост: добавляет навык «хочу разобрать»", async () => {
        await profilePage.addSkill(skillTag, "want_to_learn");
        await profilePage.page.reload();
      });

      await test.step("Хост: видит один навык", async () => {
        await expect(profilePage.wantToLearnSkill(skillTag)).toHaveCount(1);
      });

      await test.step("Хост: добавляет тот же навык ещё раз", async () => {
        await profilePage.addSkill(skillTag, "want_to_learn");
        await profilePage.page.reload();
      });

      await test.step("Хост: по-прежнему видит один навык «хочу разобрать»", async () => {
        await expect(profilePage.wantToLearnSkill(skillTag)).toHaveCount(1);
      });
    });

    test("нельзя добавить второй такой же навык «могу помочь»", async () => {
      const skillTag = `Help-${Date.now()}`;

      await test.step("Хост: добавляет навык «могу помочь»", async () => {
        await profilePage.addSkill(skillTag, "can_help");
        await profilePage.page.reload();
      });

      await test.step("Хост: видит один навык", async () => {
        await expect(profilePage.canHelpSkill(skillTag)).toHaveCount(1);
      });

      await test.step("Хост: добавляет тот же навык ещё раз", async () => {
        await profilePage.addSkill(skillTag, "can_help");
        await profilePage.page.reload();
      });

      await test.step("Хост: по-прежнему видит один навык «могу помочь»", async () => {
        await expect(profilePage.canHelpSkill(skillTag)).toHaveCount(1);
      });
    });

    test("хост убирает навык «хочу разобрать», пока слот свободен", async () => {
      const skillTag = `Want-${Date.now()}`;
      const slotDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      await test.step("Хост: добавляет навык «хочу разобрать»", async () => {
        await profilePage.addSkill(skillTag, "want_to_learn");
        await profilePage.page.reload();
      });

      await test.step("Хост: видит навык в профиле", async () => {
        await expect(profilePage.wantToLearnSkill(skillTag)).toBeVisible();
      });

      await test.step("Хост: добавляет свободный слот на завтра", async () => {
        await mySlotsPage.page.goto(ROUTES.mySlots);
        await mySlotsPage.addSlot(slotDate, "12:00");
      });

      await test.step("Хост: видит карточку слота", async () => {
        await expect(mySlotsPage.slotsCard).toHaveCount(1);
      });

      await test.step("Хост: открывает профиль", async () => {
        await profilePage.page.goto(ROUTES.profile);
      });

      await test.step("Хост: убирает навык «хочу разобрать»", async () => {
        await profilePage.removeSkill(skillTag);
        await profilePage.page.reload();
      });

      await test.step("Хост: не видит навык в профиле", async () => {
        await expect(profilePage.wantToLearnSkill(skillTag)).toHaveCount(0);
      });

      await test.step("Хост: открывает свои слоты", async () => {
        await mySlotsPage.page.goto(ROUTES.mySlots);
      });

      await test.step("Хост: видит свободный слот", async () => {
        await expect(mySlotsPage.slotsCard).toHaveCount(1);
      });
    });

    test("хост убирает навык «могу помочь», пока слот свободен", async () => {
      const skillTag = `Help-${Date.now()}`;
      const slotDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      await test.step("Хост: добавляет навык «могу помочь»", async () => {
        await profilePage.addSkill(skillTag, "can_help");
        await profilePage.page.reload();
      });

      await test.step("Хост: видит навык в профиле", async () => {
        await expect(profilePage.canHelpSkill(skillTag)).toBeVisible();
      });

      await test.step("Хост: добавляет свободный слот на завтра", async () => {
        await mySlotsPage.page.goto(ROUTES.mySlots);
        await mySlotsPage.addSlot(slotDate, "12:00");
      });

      await test.step("Хост: видит карточку слота", async () => {
        await expect(mySlotsPage.slotsCard).toHaveCount(1);
      });

      await test.step("Хост: открывает профиль", async () => {
        await profilePage.page.goto(ROUTES.profile);
      });

      await test.step("Хост: убирает навык «могу помочь»", async () => {
        await profilePage.removeSkill(skillTag);
        await profilePage.page.reload();
      });

      await test.step("Хост: не видит навык в профиле", async () => {
        await expect(profilePage.canHelpSkill(skillTag)).toHaveCount(0);
      });

      await test.step("Хост: открывает свои слоты", async () => {
        await mySlotsPage.page.goto(ROUTES.mySlots);
      });

      await test.step("Хост: видит свободный слот", async () => {
        await expect(mySlotsPage.slotsCard).toHaveCount(1);
      });
    });
  });

  test.describe("при бронировании", () => {
    const accountContexts: BrowserContext[] = [];

    test.afterEach(async () => {
      await cleanupUsersViaApi(accountContexts);
      accountContexts.length = 0;
    });

    test("хост убирает навык «хочу разобрать», когда слот уже забронирован", async ({ browser }) => {
      const runId = Date.now();
      const helpTag = `Help-${runId}`;
      const wantTag = `Want-${runId}`;
      const host = await openParticipant(browser, accountContexts, makeUser("Pank", runId));
      const guest = await openParticipant(browser, accountContexts, makeUser("Normis", runId));
      const slotDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      await test.step("Хост: регистрируется в PomidorQA", async () => {
        await registerUserViaApi(host.page, host.user);
      });

      await test.step("Хост: добавляет навык «могу помочь»", async () => {
        await host.page.goto(ROUTES.profile);
        await host.profile.addSkill(helpTag, "can_help");
        await host.page.reload();
      });

      await test.step("Хост: видит навык «могу помочь»", async () => {
        await expect(host.profile.canHelpSkill(helpTag)).toBeVisible();
      });

      await test.step("Хост: добавляет навык «хочу разобрать»", async () => {
        await host.profile.addSkill(wantTag, "want_to_learn");
        await host.page.reload();
      });

      await test.step("Хост: видит навык «хочу разобрать»", async () => {
        await expect(host.profile.wantToLearnSkill(wantTag)).toBeVisible();
      });

      await test.step("Хост: добавляет свободный слот на завтра", async () => {
        await host.page.goto(ROUTES.mySlots);
        await host.slots.addSlot(slotDate, "12:00");
      });

      await test.step("Хост: видит карточку слота", async () => {
        await expect(host.slots.slotsCard).toHaveCount(1);
      });

      await test.step("Гость: регистрируется отдельным аккаунтом", async () => {
        await registerUserViaApi(guest.page, guest.user);
      });

      await test.step("Гость: ищет хоста в каталоге по навыку", async () => {
        await guest.booking.filterCatalog(helpTag);
      });

      await test.step("Гость: видит карточку хоста", async () => {
        await expect(guest.booking.catalogCard.filter({ hasText: host.user.name })).toBeVisible();
      });

      await test.step("Гость: открывает карточку хоста", async () => {
        await guest.booking.openPerson(host.user.name);
      });

      await test.step("Гость: видит имя хоста", async () => {
        await expect(guest.booking.personName).toHaveText(host.user.name);
      });

      await test.step("Гость: открывает слот в календаре", async () => {
        await openBookingModal(guest.page);
      });

      await test.step("Гость: подтверждает бронирование", async () => {
        await guest.booking.confirmBooking();
      });

      await test.step("Гость: видит успешное бронирование", async () => {
        const success = guest.booking.bookingConfirmSuccess;
        const error = guest.booking.bookingConfirmError;

        await expect(success.or(error)).toBeVisible({ timeout: 15_000 });
        if (await error.isVisible()) {
          throw new Error(`Бронирование не удалось: ${await error.textContent()}`);
        }
      });

      await test.step("Хост: открывает профиль", async () => {
        await host.page.goto(ROUTES.profile);
      });

      await test.step("Хост: убирает навык «хочу разобрать»", async () => {
        await host.profile.removeSkill(wantTag);
        await host.page.reload();
      });

      await test.step("Хост: не видит навык «хочу разобрать»", async () => {
        await expect(host.profile.wantToLearnSkill(wantTag)).toHaveCount(0);
      });

      await test.step("Хост: открывает «Мои встречи»", async () => {
        await host.page.goto(ROUTES.bookings);
      });

      await test.step("Хост: видит бронирование гостя", async () => {
        await expect(host.booking.bookingsCardName).toHaveText(guest.user.name);
      });
    });

    test("хост убирает навык «могу помочь», когда слот уже забронирован", async ({ browser }) => {
      const runId = Date.now();
      const helpTag = `Help-${runId}`;
      const host = await openParticipant(browser, accountContexts, makeUser("Cody", runId));
      const guest = await openParticipant(browser, accountContexts, makeUser("Echo", runId));
      const slotDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      await test.step("Хост: регистрируется в PomidorQA", async () => {
        await registerUserViaApi(host.page, host.user);
      });

      await test.step("Хост: добавляет навык «могу помочь»", async () => {
        await host.page.goto(ROUTES.profile);
        await host.profile.addSkill(helpTag, "can_help");
        await host.page.reload();
      });

      await test.step("Хост: видит навык «могу помочь»", async () => {
        await expect(host.profile.canHelpSkill(helpTag)).toBeVisible();
      });

      await test.step("Хост: добавляет свободный слот на завтра", async () => {
        await host.page.goto(ROUTES.mySlots);
        await host.slots.addSlot(slotDate, "12:00");
      });

      await test.step("Хост: видит карточку слота", async () => {
        await expect(host.slots.slotsCard).toHaveCount(1);
      });

      await test.step("Гость: регистрируется отдельным аккаунтом", async () => {
        await registerUserViaApi(guest.page, guest.user);
      });

      await test.step("Гость: ищет хоста в каталоге по навыку", async () => {
        await guest.booking.filterCatalog(helpTag);
      });

      await test.step("Гость: видит карточку хоста", async () => {
        await expect(guest.booking.catalogCard.filter({ hasText: host.user.name })).toBeVisible();
      });

      await test.step("Гость: открывает карточку хоста", async () => {
        await guest.booking.openPerson(host.user.name);
      });

      await test.step("Гость: видит имя хоста", async () => {
        await expect(guest.booking.personName).toHaveText(host.user.name);
      });

      await test.step("Гость: открывает слот в календаре", async () => {
        await openBookingModal(guest.page);
      });

      await test.step("Гость: подтверждает бронирование", async () => {
        await guest.booking.confirmBooking();
      });

      await test.step("Гость: видит успешное бронирование", async () => {
        const success = guest.booking.bookingConfirmSuccess;
        const error = guest.booking.bookingConfirmError;

        await expect(success.or(error)).toBeVisible({ timeout: 15_000 });
        if (await error.isVisible()) {
          throw new Error(`Бронирование не удалось: ${await error.textContent()}`);
        }
      });

      await test.step("Хост: открывает профиль", async () => {
        await host.page.goto(ROUTES.profile);
      });

      await test.step("Хост: убирает навык «могу помочь»", async () => {
        await host.profile.removeSkill(helpTag);
        await host.page.reload();
      });

      await test.step("Хост: не видит навык «могу помочь»", async () => {
        await expect(host.profile.canHelpSkill(helpTag)).toHaveCount(0);
      });

      await test.step("Хост: открывает «Мои встречи»", async () => {
        await host.page.goto(ROUTES.bookings);
      });

      await test.step("Хост: видит бронирование гостя", async () => {
        await expect(host.booking.bookingsCardName).toHaveText(guest.user.name);
      });
    });
  });
});
