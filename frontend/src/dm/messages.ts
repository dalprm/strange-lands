export type DmTone = 'info' | 'ok' | 'warn' | 'danger';

export type DmMessage = {
  text: string;
  tone?: DmTone;
};

export function dmWelcome(): DmMessage {
  return { text: 'Добро пожаловать, правитель. Выберите провинцию и повелевайте.', tone: 'info' };
}

export function dmTurn(playerName: string, turnNumber: number): DmMessage {
  return {
    text: `Раунд ${turnNumber}. Ход переходит к ${playerName}.`,
    tone: 'info',
  };
}

export function dmBuilt(buildingLabel: string): DmMessage {
  return { text: `Возведено: ${buildingLabel}. Каменщики трудились не зря.`, tone: 'ok' };
}

export function dmRecruited(): DmMessage {
  return { text: 'Новобранцы записаны в свитки. Ждите их прибытия по ходам.', tone: 'ok' };
}

export function dmMoved(): DmMessage {
  return { text: 'Знамена подняты — войска выдвинулись к цели.', tone: 'ok' };
}

export function dmEndTurn(pending: number): DmMessage {
  return {
    text:
      pending > 0
        ? `Ход завершён. В очереди ещё ${pending} отложенных дел.`
        : 'Ход завершён. Карта затихла… до следующего приказа.',
    tone: 'info',
  };
}

export function dmError(detail: string): DmMessage {
  return { text: `Судьба не благоволит: ${detail}`, tone: 'danger' };
}

export function dmSelectProvince(name: string): DmMessage {
  return { text: `Взгляд мастера обращён к провинции ${name}.`, tone: 'info' };
}

export function dmFog(): DmMessage {
  return { text: 'Туман войны скрывает эти земли. Сюда ещё идти и идти.', tone: 'warn' };
}
