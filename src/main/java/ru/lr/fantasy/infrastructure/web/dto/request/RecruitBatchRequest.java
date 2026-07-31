package ru.lr.fantasy.infrastructure.web.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public class RecruitBatchRequest {
    @NotEmpty
    @Valid
    private List<Item> items;

    public List<Item> getItems() {
        return items;
    }

    public void setItems(List<Item> items) {
        this.items = items;
    }

    public static class Item {
        @NotNull
        private String warriorType;

        @NotNull
        @Min(1)
        private Integer count;

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
    }
}
