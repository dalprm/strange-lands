package ru.lr.fantasy;

import java.io.*;
import java.lang.annotation.Annotation;
import java.lang.reflect.Method;
import java.util.Enumeration;
import java.util.Properties;
import java.util.stream.Stream;

public class GenResources {

    public void genAllFiles(File fileView) throws IOException {
        File folderView = fileView.getParentFile();

        String fileNameWithoutExt =  fileView.getName().substring(0, fileView.getName().lastIndexOf('.'));

        String fPackage = null;
        StringWriter writerContent = new StringWriter();
        try (BufferedReader buf = new BufferedReader(new FileReader(fileView)))
        {
            buf.lines().forEach(x->writerContent.write(x+"\n"));
        }

        String content = writerContent.toString();

        fPackage = content.substring(content.indexOf("package"), content.indexOf(";") + 1);

        String beforePart = content.substring(0, content.indexOf("{")+1);
        String afterPart = content.substring(content.indexOf("{")+1);

        StringBuilder viewBuilder = new StringBuilder();
        viewBuilder.append(beforePart);
        viewBuilder.append("\n\n");
        viewBuilder.append("    ");
        viewBuilder.append("private static final ");
        viewBuilder.append(fileNameWithoutExt);
        viewBuilder.append("Msg M = GWT.create(");
        viewBuilder.append(fileNameWithoutExt);
        viewBuilder.append("Msg.class);");
        viewBuilder.append("\n\n");
        viewBuilder.append(afterPart);

        int importExist = viewBuilder.indexOf("import com.google.gwt.core.client.GWT;");
        if (importExist == -1)
        {
            int startImport = viewBuilder.indexOf("import");
            content = viewBuilder.toString();
            beforePart = content.substring(0, startImport);
            afterPart = content.substring(startImport);
            viewBuilder = new StringBuilder();
            viewBuilder.append(beforePart);
            viewBuilder.append("\n");
            viewBuilder.append("import com.google.gwt.core.client.GWT;");
            viewBuilder.append("\n");
            viewBuilder.append("import ");
            viewBuilder.append(fPackage.replace("package", "").replace(";", "").trim());
            viewBuilder.append(".");
            viewBuilder.append(fileNameWithoutExt);
            viewBuilder.append("Msg;");
            viewBuilder.append("\n");
            viewBuilder.append(afterPart);
        }

        try (BufferedWriter writer = new BufferedWriter(new FileWriter(fileView)))
        {
            writer.write(viewBuilder.toString());
        }

        StringBuilder resourceBuilder = new StringBuilder();
        resourceBuilder.append(fPackage);
        resourceBuilder.append("\n\n");
        resourceBuilder.append("import com.google.gwt.i18n.client.Messages;");
        resourceBuilder.append("\n\n");
        resourceBuilder.append("public interface ");
        resourceBuilder.append(fileNameWithoutExt);
        resourceBuilder.append("Msg extends Messages");
        resourceBuilder.append("\n");
        resourceBuilder.append("{");
        resourceBuilder.append("\n");
        resourceBuilder.append("}");

        File resourceInterface = new File(folderView, fileNameWithoutExt + "Msg.java");
        if (resourceInterface.createNewFile())
        {
            try (BufferedWriter writer = new BufferedWriter(new FileWriter(resourceInterface)))
            {
                writer.write(resourceBuilder.toString());
            }
        }

//        File resourceRu = new File(folderView, fileNameWithoutExt + "Msg_ru.properties");
//
//        resourceRu.createNewFile();
    }

    public void copyResources(File fileView) throws IOException, ClassNotFoundException {
        String fileNameWithoutExt =  fileView.getName().substring(0, fileView.getName().lastIndexOf('.'));
        String msgInterface = fileNameWithoutExt + "Msg.java";

        Properties ru = new Properties();


        String ruResources = fileNameWithoutExt + "Msg_ru.properties";


        ru.load(new FileInputStream(ruResources));

        String enResources = fileNameWithoutExt + "Msg_en.properties";
        Properties en = new Properties();

        ru.stringPropertyNames().forEach(x->en.setProperty(x, ""));
        try (FileWriter writer = new FileWriter(new File(fileView.getParentFile(), enResources))) {
            en.store(writer, "");
        }
    }

    public static void main(String[] args) throws IOException {

        GenResources genResources = new GenResources();
        File fileView = new File("D:\\Development\\Workspaces\\Java\\eclipse\\workspace\\PO.Insurance.Common.Gui.src\\src\\ru\\lois\\web\\client\\POJarvisUserInfoView.java");
        genResources.genAllFiles(fileView);
    }
}
