package ru.lr.fantasy.infrastructure.web.dto.request;

import jakarta.validation.constraints.NotNull;

public class AddPlayerToWorldRequest {
    @NotNull
    private Long playerId;

    public Long getPlayerId() {
        return playerId;
    }

    public void setPlayerId(Long playerId) {
        this.playerId = playerId;
    }
}
