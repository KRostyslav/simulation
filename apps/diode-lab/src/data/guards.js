/**
 * Підказки на межах.
 *
 * Це не «помилки»: кожна з цих ситуацій фізично законна, просто в ній легко
 * зробити хибний висновок. Тому підказка не забороняє дію, а називає, що
 * саме зараз відбувається й чому результат може виглядати дивно.
 */

import { decimal, withPrefix } from "@edu/explain";
import { MODE } from "../physics/constants.js";

export function collectWarnings(snapshot) {
  const out = [];
  const { op, analysis, mode } = snapshot;

  if (op.power > 0.1) {
    out.push({
      id: "power",
      tone: "warn",
      title: `Розсіювана потужність ${withPrefix(op.power, "Вт")}`,
      text:
        "Реальний корпус за хвилину нагрівся б на десятки градусів, пряма напруга поповзла б униз, " +
        "і точка «попливла» б просто під час запису. Модель тримає температуру сталою, тому ваші " +
        "вимірювання повторювані — але в справжній лабораторії такий струм подають короткими імпульсами.",
      codexRef: "heating",
    });
  }

  if (analysis.region.rejected.some((r) => r.reason === "на межі роздільності приладу")) {
    const count = analysis.region.rejected.filter(
      (r) => r.reason === "на межі роздільності приладу",
    ).length;
    out.push({
      id: "resolution",
      tone: "neutral",
      title: `${count} точок відкинуто: прилад їх не читає`,
      text:
        "У цих точках показ становить одиниці молодшого розряду, тобто містить лише округлення, " +
        "а не струм діода. Це не привід їх перевимірювати — це межа приладу, і в звіті так і пишуть.",
      codexRef: "measurement",
    });
  }

  if (
    analysis.region.rejected.some((r) =>
      r.reason.startsWith("завеликий струм"),
    )
  ) {
    out.push({
      id: "series",
      tone: "neutral",
      title: "Частина точок лежить у зоні послідовного опору",
      text:
        "Там ВАХ уже випрямилась у пряму закону Ома: додана напруга йде не на зниження бар'єра, " +
        "а на розігрів нейтральних областей. Якби ці точки потрапили в апроксимацію, коефіцієнт " +
        "ідеальності вийшов би вдвічі завищеним.",
      codexRef: "seriesResistance",
    });
  }

  if (analysis.fit && analysis.region.decades < 1.5 && analysis.region.enough) {
    out.push({
      id: "narrow",
      tone: "warn",
      title: `Ділянка апроксимації коротка: ${decimal(analysis.region.decades, 1)} декади`,
      text:
        "Нахил, визначений на такому відрізку, ненадійний. Візьміть більший обмежувальний резистор " +
        "і зніміть точки в ширшому діапазоні струмів — потрібно щонайменше дві декади.",
      codexRef: "leastSquares",
    });
  }

  if (analysis.fit && analysis.fit.r2 < 0.99) {
    out.push({
      id: "fit",
      tone: "warn",
      title: `Точки лягають на пряму погано: r² = ${decimal(analysis.fit.r2, 4)}`,
      text:
        "Найчастіша причина — у вибірку потрапили точки з різних режимів: частина з зони " +
        "рекомбінації, частина з зони послідовного опору. Звузьте діапазон струмів.",
      codexRef: "leastSquares",
    });
  }

  if (op.regime === "пробій") {
    out.push({
      id: "breakdown",
      tone: "neutral",
      title: "Діод у режимі пробою",
      text:
        "Це не поломка: струм обмежений резистором, і діод повернеться в нормальний стан, щойно " +
        "ви знизите напругу. Небезпечний не пробій, а перегрів — стежте за потужністю.",
      codexRef: "breakdown",
    });
  }

  if (mode !== MODE.rectifier && op.current !== 0 && Math.abs(op.current) > 0.02) {
    out.push({
      id: "overload",
      tone: "bad",
      title: "Струм перевищив 20 мА",
      text:
        "Для маломіцного діода це вже межа. Збільште обмежувальний резистор — інакше в реальній " +
        "схемі ви б просто спалили прилад.",
      codexRef: "heating",
    });
  }

  if (snapshot.temperature > 380) {
    out.push({
      id: "hot",
      tone: "warn",
      title: "Температура наближається до межі роботи приладу",
      text:
        "При такому нагріванні зворотний струм зростає на порядки, а для германієвого діода " +
        "випрямні властивості практично зникають: він проводить в обидва боки.",
      codexRef: "temperature",
    });
  }

  return out;
}
