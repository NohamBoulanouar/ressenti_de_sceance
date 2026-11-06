package fr.ressenti;

import fr.ressenti.config.AppProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(AppProperties.class)
public class RessentiApplication {

    public static void main(String[] args) {
        SpringApplication.run(RessentiApplication.class, args);
    }
}
