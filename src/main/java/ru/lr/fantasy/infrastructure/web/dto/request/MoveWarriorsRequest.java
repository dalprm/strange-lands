package ru.lr.fantasy.infrastructure.web.dto.request;

import jakarta.validation.constraints.NotNull;
import java.util.List;

public class MoveWarriorsRequest {
    @NotNull
    private Long toLandId;
    
    @NotNull
    private List<WarriorDto> warriors;
    
    private Integer turns;

    public Long getToLandId() {
        return toLandId;
    }

    public void setToLandId(Long toLandId) {
        this.toLandId = toLandId;
    }

    public List<WarriorDto> getWarriors() {
        return warriors;
    }

    public void setWarriors(List<WarriorDto> warriors) {
        this.warriors = warriors;
    }

    public Integer getTurns() {
        return turns;
    }

    public void setTurns(Integer turns) {
        this.turns = turns;
    }

    public static class WarriorDto {
        private String type;
        private Integer count;
        private Integer level;

        public String getType() {
            return type;
        }

        public void setType(String type) {
            this.type = type;
        }

        public Integer getCount() {
            return count;
        }

        public void setCount(Integer count) {
            this.count = count;
        }

        public Integer getLevel() {
            return level;
        }

        public void setLevel(Integer level) {
            this.level = level;
        }
    }
}
