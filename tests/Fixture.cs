using System;
using System.Windows.Forms;
class Fixture {
 [STAThread]static void Main(){var form=new Form{Text="Yami input verification",Width=450,Height=180,TopMost=true};var text=new TextBox{Dock=DockStyle.Fill,Multiline=true,AccessibleName="Verification text"};form.Controls.Add(text);text.TextChanged+=(s,e)=>{Console.WriteLine(text.Text);Console.Out.Flush();};Application.Run(form);}
}
