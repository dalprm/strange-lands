package ru.lr.fantasy.infrastructure.web.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public class RecruitRequest {
    @NotNull
    private String warriorType;
    
    @NotNull
    @Min(1)
    private Integer count;

    /** Через сколько вызовов {@code doTurn} завершится набор (минимум 1). */
    @Min(1)
    private Integer turnCount;

    public String getWarriorType() {
        return warriorType;
    }

    public void setWarriorType(String warriorType) {
        this.warriorType = warriorType;
    }

    public Integer getCount() {
        return count;
    }

    public void setCount(Integer count) {
        this.count = count;
    }

    public Integer getTurnCount() {
        return turnCount;
    }

    public void setTurnCount(Integer turnCount) {
        this.turnCount = turnCount;
    }
}
