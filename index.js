import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import TelegramBot from "node-telegram-bot-api";
import client from "./db/config.js";
import axios from "axios";

const app = express();
app.use(cors());
app.use(express.json());
dotenv.config();

let port = process.env.PORT || 4004;
const bot = new TelegramBot(process.env.TelegramApi, { polling: true });

bot.onText(/start/, async (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `Здравствуйте ${msg.chat.first_name}!
       Добро пожаловать! Я официальный бот HomeIdea.uz.
       Здесь можно посмотреть меню и заказать на дом!`,
    {
      reply_markup: JSON.stringify({
        keyboard: [[{ text: "Отправить контакт", request_contact: true }]],
        resize_keyboard: true,
      }),
    }
  );
});

bot.on("contact", async (msg) => {
  const find = await client.query(
    "select * from users where phone_number = $1",
    [msg.contact.phone_number]
  );

  if (find.rowCount == 0) {
    let username = msg.chat.username !== undefined ? msg.chat.username : "";

    const create = await client.query(
      "INSERT INTO users(user_id, chat_id, username, firstname, phone_number) values($1, $2, $3, $4, $5)",
      [
        msg.from.id,
        msg.chat.id,
        username,
        msg.contact.first_name,
        msg.contact.phone_number,
      ]
    );

    bot.sendMessage(msg.chat.id, `Пожалуйста отправьте геопозицию`, {
      reply_markup: JSON.stringify({
        keyboard: [[{ text: "Отправить геопозицию", request_location: true }]],
        resize_keyboard: true,
      }),
    });
  } else {
    bot.sendMessage(msg.chat.id, `Пожалуйста отправьте геопозицию`, {
      reply_markup: JSON.stringify({
        keyboard: [[{ text: "Отправить геопозицию", request_location: true }]],
        resize_keyboard: true,
      }),
    });
  }
});

bot.on("location", async (msg) => {
  let { latitude, longitude } = msg.location;
  const location = [latitude, longitude];

  let locationString = "";
  let data = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`
  )
    .then((res) => res.json())
    .then(
      (data) =>
        (locationString = `${data.address?.city}, ${data.address?.county}, ${data.address?.road}`)
    );

  const update = await client.query(
    "UPDATE users SET user_location = $1, reverse_location = $2 WHERE user_id = $3",
    [location, locationString, msg.from.id]
  );

  bot.sendMessage(
    msg.chat.id,
    `🛒 <b>Для выбора товара нажмите на кнопку "Меню" или "Поиск товара по коду"</b>

  📍 Ваш текущий адрес: ${locationString}

<i>Для изменения адреса нажмите на кнопку "Изменить геопозицию"</i>`,
    {
      reply_markup: JSON.stringify({
        keyboard: [
          [{ text: "Поиск товара по коду" }],
          [
            {
              text: `Меню`,
              web_app: { url: `https://homeidea.vercel.app/` },
            },
          ],
          [{ text: "Изменить геопозицию", request_location: true }],
        ],
        resize_keyboard: true,
      }),
      parse_mode: "HTML",
    }
  );
});

bot.on("message", async (msg) => {
  let products = await fetch("https://api-admin.billz.ai/v2/products", {
    method: "GET",
    headers: {
      Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjbGllbnRfcGxhdGZvcm1faWQiOiI3ZDRhNGMzOC1kZDg0LTQ5MDItYjc0NC0wNDg4YjgwYTRjMDEiLCJjb21wYW55X2lkIjoiZmQ1YzlhMDItOGFlZS00OTE2LThlMTQtNjE4MGVlNzJmNTViIiwiZGF0YSI6IiIsImV4cCI6MTcyMDYwMTkzMywiaWF0IjoxNjg5MDY1OTMzLCJpZCI6IjQ1Yjc5MzJjLTM5YjUtNGNlZi05N2FlLWU2NTRlZWU1MGIxYiIsInN1YmRvbWVuIjoiaG9tZWlkZWEiLCJ1c2VyX2lkIjoiYTE4MjkwZmItNGNiYS00N2RjLWEwYjUtOTVhNWYwZDFhMDQ1In0.l0hcoWATQFrXrWBNJOnSH1f7Qng8C24L1I3GK2X6z78`,
    },
  })
    .then((res) => res.json())
    .then((res) => {
      return res.products;
    });

  if (msg?.text == "Поиск товара по коду") {
    bot.sendMessage(msg.chat.id, `Пожалуйста отправьте нам код товара`, {
      reply_markup: JSON.stringify({
        keyboard: [[{ text: "Назад" }]],
        resize_keyboard: true,
      }),
    });
  } else if (msg?.text == "Назад") {
    bot.sendMessage(
      msg.chat.id,
      `Здесь можно посмотреть меню и заказать на дом!`,
      {
        reply_markup: JSON.stringify({
          keyboard: [
            [{ text: "Поиск товара по коду" }],
            [
              {
                text: `Меню`,
                web_app: { url: `https://homeidea.vercel.app/` },
              },
            ],
            [{ text: "Изменить геопозицию", request_location: true }],
          ],
          resize_keyboard: true,
        }),
      }
    );
  } else if (!msg.web_app_data?.data) {
    let codeFind = false;
    products.forEach((p) => {
      if (p?.sku.split("-").find((code) => code == msg.text)) {
        codeFind = true;
        let text = `${p.name}\n\n${p.description
          .replaceAll("<p>", "")
          .replaceAll("</p>", "")
          .replaceAll("<br>", "\n\n")
          .replaceAll(
            ";",
            ""
          )}\n Narxi: ${p?.shop_prices[0]?.retail_price.toLocaleString()}\n\n Kodi: ${p?.sku
          .split("-")
          .find(
            (code) => code == msg.text
          )}\n\n <a href="https://t.me/homeideauzbekistan">Telegram</a> | <a href="https://www.instagram.com/homeidea_uzb/">Instagram</a> | <a href="http://www.homeidea.uz/">Website</a>
          \n 📞 <a href="tel:+998917974040">+998917974040</a>\n 📱 <a href="tel:+998881391403">+998881391403</a>\n ☎ <a href="tel:+998781131403">+998781131403</a>`;

        bot.sendPhoto(msg.chat.id, `${p?.main_image_url_full}`, {
          caption: `${text}`,
          parse_mode: "HTML",
          reply_markup: JSON.stringify({
            inline_keyboard: [
              [
                {
                  text: "Оставить заявку",
                  callback_data: `${p?.sku
                    .split("-")
                    .find((code) => code == msg.text)}`,
                },
              ],
            ],
            resize_keyboard: true,
          }),
        });
      }
    });

    if (!codeFind) {
      bot.sendMessage(msg.chat.id, `Код не найден`, {
        reply_markup: JSON.stringify({
          keyboard: [[{ text: "Назад" }]],
          resize_keyboard: true,
        }),
      });
    }
  }
});

bot.on("message", async (msg) => {
  if (msg.web_app_data?.data) {
    try {
      const data = JSON.parse(msg.web_app_data.data);
      if (msg.web_app_data.data.length >= 0) {
        let user = await client.query(
          "SELECT * FROM users where user_id = $1",
          [msg.from.id]
        );

        let create = await client.query(
          "INSERT INTO applications(user_id, username, phone_number, product_code, product_name, price) values($1, $2, $3, $4, $5, $6)",
          [
            msg.from.id,
            msg.chat.username,
            user.rows[0].phone_number,
            data?.code,
            data?.name,
            data?.price,
          ]
        );

        let getApplications = await client.query("SELECT * FROM applications");

        const token = process.env.TelegramApi;
        const chat_id = process.env.CHAT_ID;
        const message = `<b>Поступил заказ с Telegram бота:</b> ${
          getApplications.rows.length + 1
        } %0A
  <b>Имя клиента:</b> ${msg.from.first_name} %0A
  <b>Номер:</b> ${user.rows[0].phone_number} ${
          msg.from.username !== undefined ? `| @${msg.from.username}` : ""
        }%0A
  <b>Адрес:</b> ${user.rows[0].reverse_location} (Локация после сообщения) %0A
  %0A
  <b>Сумма заказа:</b> ${data?.price} UZS %0A
  <b>Товар:</b> ${`%0A ${data.name} (код: ${data?.code}) x ${data.price.replace(
    /\D/g,
    " "
  )}`} %0A`;

        await axios.post(
          `https://api.telegram.org/bot${token}/sendMessage?chat_id=${chat_id}&parse_mode=html&text=${message}`
        );

        await axios.post(
          `https://api.telegram.org/bot${token}/sendLocation?chat_id=${chat_id}&latitude=${user.rows[0].user_location[0]}&longitude=${user.rows[0].user_location[1]}`
        );

        await bot.sendMessage(
          msg.chat.id,
          `Ваш заказ принят! Cкоро оператор свяжется с вами! Спасибо за доверие 😊 Для нового заказа нажмите на кнопку "Отправить контакт"`,
          {
            reply_markup: JSON.stringify({
              keyboard: [
                [{ text: "Отправить контакт", request_contact: true }],
              ],
              resize_keyboard: true,
            }),
          }
        );
      }
    } catch (error) {
      console.log("error ->", error);
    }
  }
});

bot.on("callback_query", async (msg) => {
  let products = await fetch("https://api-admin.billz.ai/v2/products", {
    method: "GET",
    headers: {
      Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjbGllbnRfcGxhdGZvcm1faWQiOiI3ZDRhNGMzOC1kZDg0LTQ5MDItYjc0NC0wNDg4YjgwYTRjMDEiLCJjb21wYW55X2lkIjoiZmQ1YzlhMDItOGFlZS00OTE2LThlMTQtNjE4MGVlNzJmNTViIiwiZGF0YSI6IiIsImV4cCI6MTcyMDYwMTkzMywiaWF0IjoxNjg5MDY1OTMzLCJpZCI6IjQ1Yjc5MzJjLTM5YjUtNGNlZi05N2FlLWU2NTRlZWU1MGIxYiIsInN1YmRvbWVuIjoiaG9tZWlkZWEiLCJ1c2VyX2lkIjoiYTE4MjkwZmItNGNiYS00N2RjLWEwYjUtOTVhNWYwZDFhMDQ1In0.l0hcoWATQFrXrWBNJOnSH1f7Qng8C24L1I3GK2X6z78`,
    },
  })
    .then((res) => res.json())
    .then((res) => {
      return res.products;
    });

  products.forEach(async (p) => {
    if (p?.sku.split("-").find((code) => code == msg.data)) {
      let user = await client.query("SELECT * FROM users where user_id = $1", [
        msg.from.id,
      ]);

      let create = await client.query(
        "INSERT INTO applications(user_id, username, phone_number, product_code, product_name, price) values($1, $2, $3, $4, $5, $6)",
        [
          msg.from.id,
          msg.from.username,
          user.rows[0].phone_number,
          msg.data,
          p?.name,
          p?.shop_prices[0]?.retail_price.toLocaleString(),
        ]
      );

      let getApplications = await client.query("SELECT * FROM applications");

      const token = process.env.TelegramApi;
      const chat_id = process.env.CHAT_ID;
      const message = `<b>Поступил заказ с Telegram бота:</b> ${
        getApplications.rows.length + 1
      } %0A
  <b>Имя клиента:</b> ${msg.from.first_name} %0A
  <b>Номер:</b> ${user.rows[0].phone_number} ${
        msg.from.username !== undefined ? `| @${msg.from.username}` : ""
      }%0A
  <b>Адрес:</b> ${user.rows[0].reverse_location} (Локация после сообщения) %0A
  %0A
  <b>Сумма заказа:</b> ${p?.shop_prices[0]?.retail_price.toLocaleString()} UZS %0A
  <b>Товар:</b> ${`%0A ${p?.name} (код: ${msg?.data}) x ${p?.shop_prices[0]?.retail_price}`} %0A`;

      await axios.post(
        `https://api.telegram.org/bot${token}/sendMessage?chat_id=${chat_id}&parse_mode=html&text=${message}`
      );

      await axios.post(
        `https://api.telegram.org/bot${token}/sendLocation?chat_id=${chat_id}&latitude=${user.rows[0].user_location[0]}&longitude=${user.rows[0].user_location[1]}`
      );

      await bot.sendMessage(
        msg.message.chat.id,
        `Ваш заказ принят! Cкоро оператор свяжется с вами! Спасибо за доверие 😊 Для нового заказа нажмите на кнопку "Отправить контакт"`,
        {
          reply_markup: JSON.stringify({
            keyboard: [[{ text: "Отправить контакт", request_contact: true }]],
            resize_keyboard: true,
          }),
        }
      );
    }
  });
});
