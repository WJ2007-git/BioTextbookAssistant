# 生物课本索引工具
一个可以ocr识别课本内容并索引关键词所在页的小型学习工具


使用环境：win10 ，建议python版本：3.12.4 ，AI功能需要Deepseek API

首先确认电脑中是否安装正确版本的python（有些版本没有相关依赖库，需自行修改requirements.txt），

之后访问https://github.com/tesseract-ocr/tesseract/releases  下载tesseract-ocr安装包，安装应用，注意要安装至C盘默认位置。

访问https://github.com/oschwartz10612/poppler-windows  下载压缩包，并将压缩包内的  poppler—-xxx(版本号)  文件夹移动到C盘program file文件夹 C:\Program Files\，

用记事本打开.env文件，填写Deepseek API码

运行bat初始化，开启bing浏览器访问本地接口http://localhost:8000/


这样就能使用工具了
![image](https://github.com/user-attachments/assets/ae493f07-4a50-480f-bf02-6fd7ad6ba0dc)

