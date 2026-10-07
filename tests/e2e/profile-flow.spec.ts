import { test, expect } from "@playwright/test";
import { TestUser, makeUser, registerUserViaApi, changeUserName, deleteUserViaApi } from "../helpers/user";
import { ProfilePage } from "../Pages/profile-page";



  test.describe("Поток изменения профиля", () => {
    let user: TestUser;
    let profilePage: ProfilePage

    test.beforeEach(async ({ page }) => {   
        const runId = Date.now();
        user = makeUser("Jango", runId);
        profilePage = new ProfilePage(page);
        await registerUserViaApi(page, user);
        await profilePage.page.goto("/pomidorqa/profile");
        await expect(profilePage.page).toHaveURL(/\/pomidorqa\/profile/);
    });

    test.afterEach(async ({ page }) => {
        await deleteUserViaApi(page.context().request).catch((reason: unknown) => {
            console.warn("Не удалось удалить тестового участника:", reason);
        });
    });

    test("Смена имени в профиле", async () => {
        const changedUserName = changeUserName(user.name);

        await test.step("Хост меняет имя в профиле", async () => {
            await profilePage.profileNameInput.fill(changedUserName.newName);
            await profilePage.save();
            await profilePage.page.reload();
        });

        await test.step("Хост видит, что имя в профиле изменилось", async () => {
            await expect(profilePage.profileNameInput).toHaveValue(changedUserName.newName);
        });
    });

    test("Хост может заполнить поле telegram", async () => {
        const telegramClasses: { name: string; value: string; saved?: string }[] = [
            { name: "латиница, апостроф и пробел", value: "I'm a Jedi" },
            { name: "кириллица", value: "Янго Фе́тт" },
            { name: "цифры", value: "25" },
            { name: "знаки препинания", value: "Да, конечно! Это — QA: тест; верно?" },
            { name: "кавычки", value: "«цитата» 'одинарные' \"двойные\"" },
            { name: "спецсимволы", value: "@#$%&*_+-=~^|\\/" },
            { name: "скобки", value: "(круглые) [квадратные] {фигурные}" },
            { name: "ссылка", value: "https://aiqa.su/pomidorqa?skill=SQL&n=1" },
            { name: "разметка как текст", value: "<b>не тег</b>" },
            { name: "диакритика", value: "café" },
            { name: "эмодзи", value: "🍅" },
            { name: "перевод строки", value: "первая строка\nвторая строка", saved: "первая строка вторая строка" },
            { name: "один символ", value: "Я" },
            { name: "повторные пробелы", value: "два  пробела" },
            { name: "пробелы по краям", value: "  джедай  ", saved: "джедай" },
            { name: "только пробелы", value: "   ", saved: "" },
            { name: "пустое значение", value: "" },
        ];

        for (const telegram of telegramClasses) {
            await test.step(`Хост заполняет Telegram: ${telegram.name}`, async () => {
                await profilePage.profileTelegramInput.fill(telegram.value);
                await profilePage.save();
                await profilePage.page.reload();
            });

            await test.step(`Хост видит Telegram: ${telegram.name}`, async () => {
                await expect(profilePage.profileTelegramInput).toHaveValue(telegram.saved ?? telegram.value);
            });
        }
    });

    test("Хост может изменить часовой пояс", async () => {
        await test.step("Хост изменяет часовой пояс", async () => {
            await profilePage.profileTimezoneSelect.selectOption("Asia/Yekaterinburg");
            await profilePage.save();
            await profilePage.page.reload();
        });

        await test.step("Хост видит, что часовой пояс изменился", async () => {
            await expect(profilePage.profileTimezoneSelect).toHaveValue("Asia/Yekaterinburg");
        });
    });

    test("Хост может добавить информацию о себе", async () => {
        const aboutClasses: { name: string; value: string; saved?: string }[] = [
            { name: "латиница, апостроф и пробел", value: "I'm a Jedi" },
            { name: "кириллица", value: "Джедай" },
            { name: "цифры", value: "25" },
            { name: "знаки препинания", value: "Да, конечно! Это — QA: тест; верно?" },
            { name: "кавычки", value: "«цитата» 'одинарные' \"двойные\"" },
            { name: "спецсимволы", value: "@#$%&*_+-=~^|\\/" },
            { name: "скобки", value: "(круглые) [квадратные] {фигурные}" },
            { name: "ссылка", value: "https://aiqa.su/pomidorqa?skill=SQL&n=1" },
            { name: "разметка как текст", value: "<b>не тег</b>" },
            { name: "диакритика", value: "café" },
            { name: "эмодзи", value: "🍅" },
            { name: "перевод строки", value: "первая строка\nвторая строка" },
            { name: "один символ", value: "Я" },
            { name: "повторные пробелы", value: "два  пробела" },
            { name: "пробелы по краям", value: "  джедай  ", saved: "джедай" },
            { name: "только пробелы", value: "   ", saved: "" },
            { name: "пустое значение", value: "" },
        ];

        for (const about of aboutClasses) {
            await test.step(`Хост заполняет «о себе»: ${about.name}`, async () => {
                await profilePage.profileAboutInput.fill(about.value);
                await profilePage.save();
                await profilePage.page.reload();
            });

            await test.step(`Хост видит «о себе»: ${about.name}`, async () => {
                await expect(profilePage.profileAboutInput).toHaveValue(about.saved ?? about.value);
            });
        }
    });

    test("Хост может добавить навык", async () => {
        const skillName = "Brainfuck";

        await test.step("Хост добавляет навык в поле can_help", async () => {
            await profilePage.addSkill(skillName, "can_help");
            await profilePage.page.reload();
        });

        await test.step("Хост видит, что навык добавился в поле can_help", async () => {
            await expect(profilePage.canHelpSkills).toContainText(skillName);
        });
    });

    test("Хост не может сохранить пустое значение в поле name", async () => {
        await test.step("Хост пытается заполнить поле name пустым значением", async () => {
            await profilePage.profileNameInput.fill("");
            await profilePage.profileSaveButton.click();
            await profilePage.page.reload();
        });

        await test.step("Хост видит, что поле name осталось прежним", async () => {
            await expect(profilePage.profileNameInput).toHaveValue(user.name);
        });
    });

    test("Хост не может добавить пустой навык в поле can_help", async () => {
        const skillName = "";

        await test.step("Хост пытается добавить навык в поле can_help", async () => {
            await profilePage.skillInput.fill(skillName);
            await profilePage.skillTypeSelect.selectOption("can_help");
            await profilePage.addSkillButton.click();
            await profilePage.page.reload();
        });

        await test.step("Хост видит, что навык не добавился в поле can_help", async () => {
            await expect(profilePage.canHelpSkills).toHaveCount(0);
            await expect(profilePage.canHelpSkills).not.toBeVisible();
        });
    });
    test("Хост не может добавить пустой навык в поле want_to_learn", async () => {
        const skillName = "";

        await test.step("Хост пытается добавить навык в поле want_to_learn", async () => {
            await profilePage.skillInput.fill(skillName);
            await profilePage.skillTypeSelect.selectOption("want_to_learn");
            await profilePage.addSkillButton.click();
            await profilePage.page.reload();
        });

        await test.step("Хост видит, что навык не добавился в поле can_help", async () => {
            await expect(profilePage.canHelpSkills).toHaveCount(0);
            await expect(profilePage.canHelpSkills).not.toBeVisible();
        });
    });
});
