package fr.ressenti.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

@ConfigurationProperties(prefix = "app")
public record AppProperties(List<String> corsOrigins, Firebase firebase) {

    public record Firebase(String projectId, boolean emulator, String firestoreEmulatorHost) {
    }
}
