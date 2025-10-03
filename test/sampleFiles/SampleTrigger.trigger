trigger SampleTrigger on Account (before insert) {
    for (Account acc : Trigger.new) {
        acc.Description = 'Created by trigger';
    }
    List<Account> accounts = [SELECT Id, Name FROM Account WHERE Type = 'Customer' LIMIT 10];
}
    