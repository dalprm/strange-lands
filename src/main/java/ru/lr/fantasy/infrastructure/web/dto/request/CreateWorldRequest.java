package ru.lr.fantasy.infrastructure.web.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public class CreateWorldRequest {
    @NotNull
    @Min(2)
    private Integer sizeX;

    @NotNull
    @Min(2)
    private Integer sizeY;

    /** Игроки, которым при создании мира случайно назначаются стартовые земли. */
    private List<Long> playerIds;

    public Integer getSizeX() {
        return sizeX;
    }

    public void setSizeX(Integer sizeX) {
        this.sizeX = sizeX;
    }

    public Integer getSizeY() {
        return sizeY;
    }

    public void setSizeY(Integer sizeY) {
        this.sizeY = sizeY;
    }

    public List<Long> getPlayerIds() {
        return playerIds;
    }

    public void setPlayerIds(List<Long> playerIds) {
        this.playerIds = playerIds;
    }
}
